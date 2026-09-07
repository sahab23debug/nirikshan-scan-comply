/**
 * Legal Metrology (Packaged Commodities) Rules, 2011 — mandatory declarations
 * and the category-driven applicability matrix used by the compliance engine.
 */

export type Category = "Food" | "Cosmetics" | "Electronics" | "Textiles" | "Stationery" | "Other";

export const CATEGORIES: Category[] = [
  "Food",
  "Cosmetics",
  "Electronics",
  "Textiles",
  "Stationery",
  "Other",
];

export type DeclarationKey =
  | "manufacturer_details"
  | "country_of_origin"
  | "common_name"
  | "net_quantity"
  | "manufacturing_date"
  | "best_before"
  | "mrp"
  | "consumer_care"
  | "dimensions"
  | "unit_sale_price";

export interface Declaration {
  key: DeclarationKey;
  label: string;
  rule: string;
  hint: string;
  /** Categories this declaration is mandatory for. "*" = all categories. */
  categories: Category[] | "*";
  /** Conditional declarations are only flagged when the condition applies. */
  conditional?: string;
}

export const DECLARATIONS: Declaration[] = [
  {
    key: "manufacturer_details",
    label: "Manufacturer / Packer / Importer",
    rule: "Rule 6(1)(a)",
    hint: "Full name and complete address of the manufacturer, packer or importer.",
    categories: "*",
  },
  {
    key: "country_of_origin",
    label: "Country of origin",
    rule: "Rule 6(1)(a) proviso",
    hint: "Mandatory for imported packages only.",
    categories: "*",
    conditional: "Imported goods only",
  },
  {
    key: "common_name",
    label: "Product / common name",
    rule: "Rule 6(1)(b)",
    hint: "The common or generic name of the commodity inside the package.",
    categories: "*",
  },
  {
    key: "net_quantity",
    label: "Net quantity",
    rule: "Rule 6(1)(c)",
    hint: "Net weight, volume or number in standard units.",
    categories: "*",
  },
  {
    key: "manufacturing_date",
    label: "Month & year of manufacture / packing",
    rule: "Rule 6(1)(d)",
    hint: "Month and year in which the commodity was manufactured, packed or imported.",
    categories: "*",
  },
  {
    key: "best_before",
    label: "Best before / Use by date",
    rule: "Rule 6(1)(d) proviso",
    hint: "Required where the commodity has a shelf life.",
    categories: ["Food", "Cosmetics"],
    conditional: "Perishable / shelf-life goods",
  },
  {
    key: "mrp",
    label: "Retail sale price (MRP, inclusive of all taxes)",
    rule: "Rule 6(1)(e)",
    hint: "Must read 'Maximum Retail Price ... inclusive of all taxes'.",
    categories: "*",
  },
  {
    key: "consumer_care",
    label: "Consumer care details",
    rule: "Rule 6(1)(f)",
    hint: "Name, address, phone or email of the person handling consumer complaints.",
    categories: "*",
  },
  {
    key: "dimensions",
    label: "Dimensions of the commodity",
    rule: "Rule 6(1)(g)",
    hint: "Required where the commodity is sold by dimension (paper, tissue, textiles).",
    categories: ["Textiles", "Stationery", "Other"],
    conditional: "Goods sold by dimension",
  },
  {
    key: "unit_sale_price",
    label: "Unit sale price",
    rule: "Rule 6(1)(e) proviso",
    hint: "Required on multi-piece / combination packages.",
    categories: "*",
    conditional: "Multi-piece packages only",
  },
];

export function applicableDeclarations(category: Category, imported: boolean, multiPack: boolean) {
  return DECLARATIONS.filter((d) => {
    if (d.key === "country_of_origin") return imported;
    if (d.key === "unit_sale_price") return multiPack;
    return d.categories === "*" || d.categories.includes(category);
  });
}

export type FieldVerdict = "pass" | "fail" | "review";
export type OverallStatus = "compliant" | "non_compliant" | "needs_review";

export interface FieldResult {
  key: DeclarationKey;
  label: string;
  rule: string;
  valuePresent: boolean;
  extractedValue: string | null;
  legible: boolean;
  fontSizeAdequate: boolean;
  contrastAdequate: boolean;
  confidence: number;
  notes: string | null;
  verdict: FieldVerdict;
  /** Value registered by an officer in the approved product repository, if any. */
  expectedValue?: string | null;
  /** Whether the printed label agrees with the registered declaration. */
  matchesExpected?: boolean | null;
}

export const CONFIDENCE_REVIEW_THRESHOLD = 0.6;

export function verdictForField(
  f: Omit<FieldResult, "verdict" | "label" | "rule">,
): FieldVerdict {
  // A declaration that is missing altogether is the only automatic failure.
  if (!f.valuePresent) return f.confidence < CONFIDENCE_REVIEW_THRESHOLD ? "review" : "fail";
  // Printed value contradicts the officer-approved declaration on record.
  if (f.matchesExpected === false) return "fail";
  if (f.confidence < CONFIDENCE_REVIEW_THRESHOLD) return "review";
  // Present but the text was actually read: size/contrast concerns are a judgement
  // call for the officer, not an automatic non-compliance.
  const readValue = (f.extractedValue ?? "").trim().length > 0;
  if (!f.legible && !readValue) return "fail";
  if (!f.legible || !f.fontSizeAdequate || !f.contrastAdequate) return "review";
  return "pass";
}


export function overallStatus(fields: FieldResult[]): OverallStatus {
  if (fields.some((f) => f.verdict === "fail")) return "non_compliant";
  if (fields.some((f) => f.verdict === "review")) return "needs_review";
  return "compliant";
}

export const STATUS_LABEL: Record<OverallStatus, string> = {
  compliant: "Compliant",
  non_compliant: "Non-Compliant",
  needs_review: "Needs Manual Review",
};

/** Nutri-Score style informational grading (food & beverage only). */
export interface NutritionSnapshot {
  servingSize: string | null;
  calories: number | null;
  fat: number | null;
  saturatedFat: number | null;
  sugar: number | null;
  protein: number | null;
  sodium: number | null;
  fibre: number | null;
  found: boolean;
}

export type HealthGrade = "A" | "B" | "C" | "D" | "E";

export function gradeNutrition(n: NutritionSnapshot): { grade: HealthGrade; points: number } {
  const neg =
    scorePoints(n.calories, [80, 160, 240, 320, 400, 480, 560, 640, 720, 800]) +
    scorePoints(n.saturatedFat ?? n.fat, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) +
    scorePoints(n.sugar, [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45]) +
    scorePoints(n.sodium, [90, 180, 270, 360, 450, 540, 630, 720, 810, 900]);
  const pos =
    scorePoints(n.fibre, [0.9, 1.9, 2.8, 3.7, 4.7]) + scorePoints(n.protein, [1.6, 3.2, 4.8, 6.4, 8]);
  const points = neg - pos;
  const grade: HealthGrade =
    points <= -1 ? "A" : points <= 2 ? "B" : points <= 10 ? "C" : points <= 18 ? "D" : "E";
  return { grade, points };
}

function scorePoints(value: number | null | undefined, thresholds: number[]): number {
  if (value == null || Number.isNaN(value)) return 0;
  let pts = 0;
  for (const t of thresholds) if (value > t) pts += 1;
  return pts;
}

export const GRADE_COPY: Record<HealthGrade, string> = {
  A: "Excellent nutritional profile",
  B: "Good nutritional profile",
  C: "Moderate — enjoy in balance",
  D: "Poor — high in fat, sugar or salt",
  E: "Very poor — high in fat, sugar or salt",
};
