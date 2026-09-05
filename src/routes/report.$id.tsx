import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  FileJson,
  Share2,
  MessageCircle,
  Link2,
  Flag,
  MapPin,
  Clock,
  Loader2,
  Apple,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchReport, signedImageUrl, distanceKm } from "@/lib/queries";
import {
  GRADE_COPY,
  gradeNutrition,
  STATUS_LABEL,
  type FieldResult,
  type HealthGrade,
} from "@/lib/rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/report/$id")({
  head: () => ({
    meta: [
      { title: "Compliance report — Nirikshan AI" },
      {
        name: "description",
        content:
          "Declaration-by-declaration Legal Metrology compliance report with photos, location and export options.",
      },
      { property: "og:title", content: "Compliance report — Nirikshan AI" },
      {
        property: "og:description",
        content: "Legal Metrology label compliance verdict with full evidence trail.",
      },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { id } = Route.useParams();
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [flagging, setFlagging] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  const { data: report, isLoading } = useQuery({
    queryKey: ["report", id],
    queryFn: () => fetchReport(id),
    enabled: Boolean(session),
  });

  const { data: photos } = useQuery({
    queryKey: ["report-photos", id, report?.scans?.images?.length],
    queryFn: async () => {
      const paths = report?.scans?.images ?? [];
      const urls = await Promise.all(paths.map((p) => signedImageUrl(p)));
      return urls.filter((u): u is string => Boolean(u));
    },
    enabled: Boolean(report?.scans?.images?.length),
  });

  const { data: flag } = useQuery({
    queryKey: ["report-flag", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("citizen_flags")
        .select("id,status,officer_registry_id")
        .eq("report_id", id)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(session),
  });

  const fields = (report?.fields ?? []) as FieldResult[];
  const nutrition = report?.nutrition ?? null;
  const grade = useMemo(
    () => (nutrition && nutrition.found ? gradeNutrition(nutrition) : null),
    [nutrition],
  );

  const flagToOfficer = async () => {
    if (!report?.scans) return;
    setFlagging(true);
    const { data: officers } = await supabase
      .from("officer_registry")
      .select("officer_id,officer_name,district,home_lat,home_lng");
    if (!officers?.length) {
      setFlagging(false);
      toast.error("No officers are available on the register right now.");
      return;
    }
    const lat = report.scans.lat ?? 28.6139;
    const lng = report.scans.lng ?? 77.209;
    const nearest = officers
      .map((o) => ({ ...o, km: distanceKm(lat, lng, o.home_lat, o.home_lng) }))
      .sort((a, b) => a.km - b.km)[0];

    const { error } = await supabase.from("citizen_flags").insert({
      report_id: report.id,
      citizen_id: session!.user.id,
      officer_registry_id: nearest.officer_id,
      note: `${STATUS_LABEL[report.overall_status]} — ${report.scans.product_name ?? "product"} reported by a citizen.`,
    });
    setFlagging(false);
    if (error) {
      toast.error("Could not send this case. It may already be flagged.");
      return;
    }
    await supabase.from("audit_events").insert({
      user_id: session!.user.id,
      action: "citizen_flag_created",
      entity: "report",
      entity_id: report.id,
      details: { officer_id: nearest.officer_id },
    });
    toast.success(`Sent to ${nearest.officer_name}, ${nearest.district} (${nearest.km.toFixed(1)} km away)`);
    void qc.invalidateQueries({ queryKey: ["report-flag", id] });
    void qc.invalidateQueries({ queryKey: ["flags"] });
  };

  if (isLoading || !report) {
    return (
      <AppShell>
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="mt-3 h-80 w-full rounded-2xl" />
      </AppShell>
    );
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `Nirikshan AI compliance report — ${report.scans?.product_name ?? "Product"}: ${STATUS_LABEL[report.overall_status]}`;

  return (
    <AppShell>
      <Button
        variant="ghost"
        className="mb-2 -ml-2 print:hidden"
        onClick={() => navigate({ to: "/dashboard" })}
      >
        <ArrowLeft className="size-4" /> Back to dashboard
      </Button>

      <Card className="overflow-hidden shadow-lift animate-fade-up">
        <div className="bg-hero-gradient p-5 text-primary-foreground">
          <p className="text-xs uppercase tracking-wide text-primary-foreground/75">
            Legal Metrology (Packaged Commodities) Rules, 2011
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold">
            {report.scans?.product_name ?? "Unnamed product"}
          </h1>
          <p className="text-sm text-primary-foreground/80">
            {report.scans?.category}
            {report.scans?.barcode ? ` · ${report.scans.barcode}` : ""}
          </p>
          <div className="mt-3">
            <StatusBadge
              status={report.overall_status}
              size="lg"
              className="bg-background/95 backdrop-blur"
            />
          </div>
        </div>
        <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-2">
          <p className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" />
            {new Date(report.created_at).toLocaleString("en-IN")}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="size-4" />
            {report.scans?.lat != null
              ? `${report.scans.lat.toFixed(5)}, ${report.scans.lng?.toFixed(5)}`
              : "Location not captured"}
          </p>
          {report.scans?.lat != null && (
            <a
              className="text-xs font-semibold text-primary underline sm:col-span-2 print:hidden"
              href={`https://www.google.com/maps?q=${report.scans.lat},${report.scans.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              View scan location on map
            </a>
          )}
        </CardContent>
      </Card>

      {photos && photos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={`Captured label ${i + 1}`}
              loading="lazy"
              className="aspect-square w-full rounded-xl border object-cover shadow-soft"
            />
          ))}
        </div>
      )}

      <Card className="mt-4 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mandatory declarations checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {fields.map((f, i) => (
            <ChecklistRow key={f.key} field={f} index={i} />
          ))}
        </CardContent>
      </Card>

      {grade && nutrition && (
        <Card className="mt-4 shadow-soft animate-fade-up">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Apple className="size-4 text-citizen" /> Product Health Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  "grid size-14 place-items-center rounded-2xl font-display text-2xl font-bold",
                  gradeStyle(grade.grade),
                )}
              >
                {grade.grade}
              </span>
              <div>
                <p className="font-semibold">{GRADE_COPY[grade.grade]}</p>
                <p className="text-xs text-muted-foreground">
                  Per serving {nutrition.servingSize ? `(${nutrition.servingSize})` : ""}
                </p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <NutrientCell label="Energy" value={nutrition.calories} unit="kcal" />
              <NutrientCell label="Fat" value={nutrition.fat} unit="g" />
              <NutrientCell label="Saturated fat" value={nutrition.saturatedFat} unit="g" />
              <NutrientCell label="Sugar" value={nutrition.sugar} unit="g" />
              <NutrientCell label="Protein" value={nutrition.protein} unit="g" />
              <NutrientCell label="Sodium" value={nutrition.sodium} unit="mg" />
            </dl>
            <p className="mt-3 rounded-lg bg-muted p-2 text-xs text-muted-foreground">
              Informational wellness guidance only. It is not part of the legal compliance verdict
              and carries no enforcement value.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 print:hidden">
        <Button variant="secondary" onClick={() => window.print()}>
          <Download className="size-4" /> Export as PDF
        </Button>
        <Button variant="secondary" onClick={() => downloadJson(report)}>
          <FileJson className="size-4" /> Export editable JSON
        </Button>
        <Button variant="secondary" onClick={() => downloadCsv(report.id, fields)}>
          <Download className="size-4" /> Export CSV
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({ title: "Nirikshan AI report", text: shareText, url: shareUrl });
                return;
              } catch {
                /* share cancelled */
              }
            }
            await navigator.clipboard.writeText(shareUrl);
            toast.success("Report link copied");
          }}
        >
          <Share2 className="size-4" /> Share report
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            window.open(
              `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
              "_blank",
              "noopener",
            )
          }
        >
          <MessageCircle className="size-4" /> Share on WhatsApp
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(shareUrl);
            toast.success("Report link copied");
          }}
        >
          <Link2 className="size-4" /> Copy link
        </Button>
      </div>

      {profile?.role === "citizen" &&
        report.overall_status !== "compliant" &&
        report.user_id === session?.user.id && (
          <Card className="mt-4 border-destructive/30 bg-destructive/5 shadow-soft print:hidden">
            <CardContent className="p-4">
              <h3 className="font-display text-base font-semibold">Report to an officer</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This product failed one or more mandatory declarations. Send the report to the
                nearest Legal Metrology officer for action.
              </p>
              {flag ? (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-sm font-semibold">
                  <Flag className="size-4 text-destructive" />
                  Sent to {flag.officer_registry_id} · {flag.status}
                </p>
              ) : (
                <Button className="mt-3" onClick={flagToOfficer} disabled={flagging}>
                  {flagging ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
                  Send to nearby officer
                </Button>
              )}
            </CardContent>
          </Card>
        )}
    </AppShell>
  );
}

function ChecklistRow({ field, index }: { field: FieldResult; index: number }) {
  const Icon =
    field.verdict === "pass" ? CheckCircle2 : field.verdict === "fail" ? XCircle : AlertTriangle;
  const tone =
    field.verdict === "pass"
      ? "text-success"
      : field.verdict === "fail"
        ? "text-destructive"
        : "text-warning";

  const issues: string[] = [];
  if (!field.valuePresent) issues.push("Declaration not found on the label");
  if (field.valuePresent && !field.legible) issues.push("Not legible");
  if (field.valuePresent && !field.fontSizeAdequate) issues.push("Text too small / not prominent");
  if (field.valuePresent && !field.contrastAdequate) issues.push("Poor contrast or cluttered area");
  if (field.verdict === "review") issues.push("Low reading confidence — manual check required");

  return (
    <div
      className="flex gap-3 rounded-xl border p-3 animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 10) * 70}ms` }}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", tone)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{field.label}</p>
        <p className="text-xs text-muted-foreground">{field.rule}</p>
        <p className="mt-1 break-words text-sm">
          {field.extractedValue ? (
            <span className="font-medium">{field.extractedValue}</span>
          ) : (
            <span className="text-muted-foreground">No value extracted</span>
          )}
        </p>
        {issues.length > 0 && (
          <ul className={cn("mt-1 space-y-0.5 text-xs", tone)}>
            {issues.map((i) => (
              <li key={i}>• {i}</li>
            ))}
          </ul>
        )}
        {field.notes && <p className="mt-1 text-xs text-muted-foreground">{field.notes}</p>}
      </div>
      <span className="self-start rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        {Math.round(field.confidence * 100)}%
      </span>
    </div>
  );
}

function NutrientCell({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <div className="rounded-lg border p-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value == null ? "—" : `${value} ${unit}`}</dd>
    </div>
  );
}

function gradeStyle(grade: HealthGrade) {
  switch (grade) {
    case "A":
    case "B":
      return "bg-success/15 text-success";
    case "C":
      return "bg-warning/20 text-warning";
    default:
      return "bg-destructive/15 text-destructive";
  }
}

function downloadJson(report: unknown) {
  triggerDownload(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    "nirikshan-report.json",
  );
}

function downloadCsv(id: string, fields: FieldResult[]) {
  const header =
    "report_id,declaration,rule,verdict,present,extracted_value,legible,font_size_adequate,contrast_adequate,confidence";
  const rows = fields.map((f) =>
    [
      id,
      f.label,
      f.rule,
      f.verdict,
      f.valuePresent,
      f.extractedValue ?? "",
      f.legible,
      f.fontSizeAdequate,
      f.contrastAdequate,
      f.confidence,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  triggerDownload(
    new Blob([[header, ...rows].join("\n")], { type: "text/csv" }),
    "nirikshan-report.csv",
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
