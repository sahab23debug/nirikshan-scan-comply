import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  applicableDeclarations,
  overallStatus,
  verdictForField,
  type Category,
  type FieldResult,
  type NutritionSnapshot,
} from "./rules";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";

const InputSchema = z.object({
  images: z.array(z.string().min(16)).min(1).max(4),
  category: z.string(),
  imported: z.boolean(),
  multiPack: z.boolean(),
});

/**
 * Documented response contract requested from the vision model.
 *
 * {
 *   "fields": [
 *     {
 *       "field": "<declaration key>",
 *       "valuePresent": boolean,      // declaration physically printed on the label
 *       "extractedValue": string|null,// verbatim text read from the label
 *       "legible": boolean,           // readable without magnification
 *       "fontSizeAdequate": boolean,  // meets prominence expectations vs other label text
 *       "contrastAdequate": boolean,  // sufficient contrast, not hidden in clutter
 *       "confidence": number,         // 0..1 certainty of this reading
 *       "notes": string|null          // short officer-facing observation
 *     }
 *   ],
 *   "productName": string|null,
 *   "nutrition": { servingSize, calories, fat, saturatedFat, sugar, protein, sodium, fibre, found }
 * }
 */
const ModelField = z.object({
  field: z.string(),
  valuePresent: z.boolean(),
  extractedValue: z.string().nullable().optional(),
  legible: z.boolean(),
  fontSizeAdequate: z.boolean(),
  contrastAdequate: z.boolean(),
  confidence: z.number(),
  notes: z.string().nullable().optional(),
});

const ModelResponse = z.object({
  productName: z.string().nullable().optional(),
  fields: z.array(ModelField),
  nutrition: z
    .object({
      servingSize: z.string().nullable().optional(),
      calories: z.number().nullable().optional(),
      fat: z.number().nullable().optional(),
      saturatedFat: z.number().nullable().optional(),
      sugar: z.number().nullable().optional(),
      protein: z.number().nullable().optional(),
      sodium: z.number().nullable().optional(),
      fibre: z.number().nullable().optional(),
      found: z.boolean().optional(),
    })
    .nullable()
    .optional(),
});

export const analyzeLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const category = data.category as Category;
    const applicable = applicableDeclarations(category, data.imported, data.multiPack);
    const isFood = category === "Food";

    const schemaLines = applicable
      .map((d) => `- "${d.key}" — ${d.label} (${d.rule}). ${d.hint}`)
      .join("\n");

    const systemPrompt = `You are a Legal Metrology (Packaged Commodities) Rules, 2011 label inspector for India's Department of Consumer Affairs.
You inspect photographs of a packaged commodity label and report, per declaration, whether it is present AND whether it is legible and prominent.
Rules for your judgement:
- valuePresent: true only if the declaration is actually printed on the label images.
- extractedValue: the verbatim text as printed (include units and currency), else null.
- legible: false if blurred, cut off, overprinted or unreadable at normal viewing.
- fontSizeAdequate: false if the text height is clearly smaller than other mandatory declarations or too small to read at arm's length.
- contrastAdequate: false if low contrast against the background or buried in visual clutter.
- confidence: 0..1 for how certain you are of this reading. Use below 0.6 when the image quality prevents a reliable determination.
Never guess values you cannot see. Return strict JSON only, no prose, no markdown.`;

    const userPrompt = `Product category: ${category}. Imported: ${data.imported}. Multi-piece pack: ${data.multiPack}.
Assess exactly these declarations, using these exact field keys:
${schemaLines}

Return JSON of this exact shape:
{"productName": string|null,
 "fields": [{"field": string, "valuePresent": boolean, "extractedValue": string|null, "legible": boolean, "fontSizeAdequate": boolean, "contrastAdequate": boolean, "confidence": number, "notes": string|null}],
 "nutrition": ${
   isFood
     ? `{"servingSize": string|null, "calories": number|null, "fat": number|null, "saturatedFat": number|null, "sugar": number|null, "protein": number|null, "sodium": number|null, "fibre": number|null, "found": boolean} (per serving; sodium in mg, others in g/kcal; found=false if no nutrition table is visible)`
     : `null`
 }}
Include one entry per requested field key, in the same order.`;

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              ...data.images.map((url) => ({ type: "image_url", image_url: { url } })),
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI is busy right now. Please try the scan again in a moment.");
      if (res.status === 402)
        throw new Error("AI credits for this workspace are exhausted. Add credits to continue scanning.");
      throw new Error(`Label analysis failed (${res.status}). ${body.slice(0, 200)}`);
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = payload.choices?.[0]?.message?.content ?? "";
    const parsed = ModelResponse.safeParse(safeJson(raw));
    if (!parsed.success) {
      throw new Error("The label could not be read reliably. Please retake the photos in better light.");
    }

    const byKey = new Map(parsed.data.fields.map((f) => [f.field, f]));
    const fields: FieldResult[] = applicable.map((d) => {
      const m = byKey.get(d.key);
      const base = {
        key: d.key,
        valuePresent: m?.valuePresent ?? false,
        extractedValue: m?.extractedValue ?? null,
        legible: m?.legible ?? false,
        fontSizeAdequate: m?.fontSizeAdequate ?? false,
        contrastAdequate: m?.contrastAdequate ?? false,
        confidence: clamp(m?.confidence ?? 0),
        notes: m?.notes ?? (m ? null : "No reading returned for this declaration."),
      };
      return { ...base, label: d.label, rule: d.rule, verdict: verdictForField(base) };
    });

    const nutrition: NutritionSnapshot | null =
      isFood && parsed.data.nutrition
        ? {
            servingSize: parsed.data.nutrition.servingSize ?? null,
            calories: num(parsed.data.nutrition.calories),
            fat: num(parsed.data.nutrition.fat),
            saturatedFat: num(parsed.data.nutrition.saturatedFat),
            sugar: num(parsed.data.nutrition.sugar),
            protein: num(parsed.data.nutrition.protein),
            sodium: num(parsed.data.nutrition.sodium),
            fibre: num(parsed.data.nutrition.fibre),
            found: parsed.data.nutrition.found ?? true,
          }
        : null;

    return {
      productName: parsed.data.productName ?? null,
      fields,
      nutrition,
      status: overallStatus(fields),
    };
  });

function clamp(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function num(v: number | null | undefined) {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function safeJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
