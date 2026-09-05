import { supabase } from "@/integrations/supabase/client";
import type { FieldResult, NutritionSnapshot, OverallStatus } from "@/lib/rules";

export interface ScanRow {
  id: string;
  user_id: string;
  product_name: string | null;
  category: string;
  barcode: string | null;
  images: string[];
  lat: number | null;
  lng: number | null;
  location_label: string | null;
  created_at: string;
}

export interface ReportRow {
  id: string;
  scan_id: string;
  user_id: string;
  overall_status: OverallStatus;
  fields: FieldResult[];
  nutrition: NutritionSnapshot | null;
  summary: string | null;
  created_at: string;
  scans: ScanRow | null;
}

export async function fetchReports(): Promise<ReportRow[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("*, scans(*)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as ReportRow[];
}

export async function fetchReport(id: string): Promise<ReportRow | null> {
  const { data, error } = await supabase
    .from("reports")
    .select("*, scans(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ReportRow) ?? null;
}

export interface FlagRow {
  id: string;
  report_id: string;
  citizen_id: string;
  officer_registry_id: string;
  note: string | null;
  status: "pending" | "acknowledged" | "resolved";
  created_at: string;
  acknowledged_at: string | null;
  reports: ReportRow | null;
}

export async function fetchFlags(): Promise<FlagRow[]> {
  const { data, error } = await supabase
    .from("citizen_flags")
    .select("*, reports(*, scans(*))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FlagRow[];
}

/** Signed URL for a private scan photo (officers and the owner can read). */
export async function signedImageUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("scan-images").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
