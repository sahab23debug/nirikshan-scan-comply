import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { dataUrlToBlob } from "@/lib/offline";
import type { Category, DeclarationKey, FieldResult, NutritionSnapshot, OverallStatus } from "@/lib/rules";

export interface ScanInput {
  images: { dataUrl: string; blob?: Blob; name: string }[];
  category: Category;
  imported: boolean;
  multiPack: boolean;
  barcode: string | null;
  productName: string | null;
  batchId: string | null;
  lat: number | null;
  lng: number | null;
  expected?: Partial<Record<DeclarationKey, string>>;
}

type AnalyzeFn = (args: {
  data: {
    images: string[];
    category: string;
    imported: boolean;
    multiPack: boolean;
    expected?: Record<string, string>;
  };
}) => Promise<{
  productName: string | null;
  fields: FieldResult[];
  nutrition: NutritionSnapshot | null;
  status: OverallStatus;
}>;

/**
 * Runs the AI reading and the storage upload at the same time, then writes the
 * scan + report rows. Used by the live scan screen and by the offline queue.
 */
export async function submitScan(
  analyze: AnalyzeFn,
  userId: string,
  input: ScanInput,
): Promise<{ reportId: string; status: OverallStatus }> {
  const folder = `${userId}/${crypto.randomUUID()}`;

  const analysisPromise = analyze({
    data: {
      images: input.images.map((i) => i.dataUrl),
      category: input.category,
      imported: input.imported,
      multiPack: input.multiPack,
      ...(input.expected && Object.keys(input.expected).length
        ? { expected: input.expected as Record<string, string> }
        : {}),
    },
  });

  const uploadPromise = Promise.all(
    input.images.map(async (img) => {
      const path = `${folder}/${img.name}`;
      const body = img.blob ?? dataUrlToBlob(img.dataUrl);
      const { error } = await supabase.storage
        .from("scan-images")
        .upload(path, body, { contentType: "image/jpeg" });
      return error ? null : path;
    }),
  );

  const [result, uploaded] = await Promise.all([analysisPromise, uploadPromise]);
  const paths = uploaded.filter((p): p is string => Boolean(p));

  const { data: scan, error: scanError } = await supabase
    .from("scans")
    .insert({
      user_id: userId,
      product_name: input.productName?.trim() || result.productName || "Unnamed product",
      category: input.category,
      barcode: input.barcode?.trim() || null,
      images: paths,
      lat: input.lat,
      lng: input.lng,
    })
    .select("id")
    .single();
  if (scanError || !scan) throw new Error("Could not save the scan.");

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      scan_id: scan.id,
      user_id: userId,
      batch_id: input.batchId,
      overall_status: result.status,
      fields: result.fields as unknown as Json,
      nutrition: (result.nutrition ?? null) as unknown as Json,
      summary: `${result.fields.filter((f) => f.verdict === "pass").length} of ${result.fields.length} applicable declarations compliant.`,
    })
    .select("id")
    .single();
  if (reportError || !report) throw new Error("Could not save the report.");

  // Fire-and-forget bookkeeping so the officer sees the report immediately.
  void (async () => {
    if (input.barcode?.trim() && (input.productName?.trim() || result.productName)) {
      await supabase.from("products").upsert(
        {
          barcode: input.barcode.trim(),
          name: input.productName?.trim() || result.productName!,
          category: input.category,
        },
        { onConflict: "barcode" },
      );
    }
    await supabase.from("audit_events").insert({
      user_id: userId,
      action: "scan_completed",
      entity: "report",
      entity_id: report.id,
      details: { status: result.status, category: input.category, batch_id: input.batchId },
    });
  })();

  return { reportId: report.id, status: result.status };
}
