import { supabase } from "@/integrations/supabase/client";
import type { Category, DeclarationKey, NutritionSnapshot } from "@/lib/rules";

export interface ApprovedProduct {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  category: Category;
  imported: boolean;
  multi_pack: boolean;
  declarations: Partial<Record<DeclarationKey, string>>;
  nutrition: NutritionSnapshot | null;
  submitted_by: string;
  officer_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function fetchApprovedProducts(search?: string): Promise<ApprovedProduct[]> {
  let q = supabase
    .from("approved_products")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const term = search?.trim();
  if (term) q = q.or(`name.ilike.%${term}%,barcode.ilike.%${term}%,brand.ilike.%${term}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ApprovedProduct[];
}

export async function findApprovedByBarcode(barcode: string): Promise<ApprovedProduct | null> {
  const { data, error } = await supabase
    .from("approved_products")
    .select("*")
    .eq("barcode", barcode.trim())
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ApprovedProduct) ?? null;
}

export interface BatchRow {
  id: string;
  user_id: string;
  title: string;
  note: string | null;
  location_label: string | null;
  created_at: string;
}

export async function fetchBatch(id: string): Promise<BatchRow | null> {
  const { data, error } = await supabase
    .from("scan_batches")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as BatchRow) ?? null;
}

export async function fetchBatches(): Promise<BatchRow[]> {
  const { data, error } = await supabase
    .from("scan_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as BatchRow[];
}
