import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { ArrowLeft, ChevronRight, Download, Layers, Plus, ScanLine } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { ScanThumb } from "@/components/ScanThumb";
import { ComplianceCharts } from "@/components/ComplianceCharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { fetchBatchReports } from "@/lib/queries";
import { fetchBatch } from "@/lib/repository";
import { STATUS_LABEL } from "@/lib/rules";

export const Route = createFileRoute("/batch/$id")({
  head: () => ({
    meta: [
      { title: "Combined batch report — Nirikshan AI" },
      {
        name: "description",
        content:
          "One combined Legal Metrology compliance report for every product inspected in a single visit.",
      },
      { property: "og:title", content: "Combined batch report — Nirikshan AI" },
      {
        property: "og:description",
        content: "Batch inspection summary with per-product compliance reports.",
      },
    ],
  }),
  component: BatchReport,
  errorComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">This batch report could not be loaded.</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">This batch report does not exist.</p>
    </AppShell>
  ),
});

function BatchReport() {
  const { id } = Route.useParams();
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  const batchQuery = useQuery({
    queryKey: ["batch", id],
    queryFn: () => fetchBatch(id),
    enabled: Boolean(session),
    staleTime: 60_000,
  });
  const reportsQuery = useQuery({
    queryKey: ["batch-reports", id],
    queryFn: () => fetchBatchReports(id),
    enabled: Boolean(session),
    staleTime: 30_000,
  });

  const reports = useMemo(() => reportsQuery.data ?? [], [reportsQuery.data]);
  const counts = {
    compliant: reports.filter((r) => r.overall_status === "compliant").length,
    review: reports.filter((r) => r.overall_status === "needs_review").length,
    failed: reports.filter((r) => r.overall_status === "non_compliant").length,
  };

  const exportJson = () => {
    const payload = {
      batch: batchQuery.data,
      generatedAt: new Date().toISOString(),
      products: reports.map((r) => ({
        reportId: r.id,
        product: r.scans?.product_name,
        category: r.scans?.category,
        barcode: r.scans?.barcode,
        status: r.overall_status,
        fields: r.fields,
      })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `nirikshan-batch-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <Button variant="ghost" className="mb-2 -ml-2" onClick={() => navigate({ to: "/dashboard" })}>
        <ArrowLeft className="size-4" /> Back
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Layers className="size-3.5" /> Combined batch report
          </p>
          <h1 className="font-display text-2xl font-bold">
            {batchQuery.data?.title ?? "Batch inspection"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {reports.length} product{reports.length === 1 ? "" : "s"} inspected
            {batchQuery.data ? ` · ${new Date(batchQuery.data.created_at).toLocaleString("en-IN")}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportJson} disabled={!reports.length}>
            <Download className="size-4" /> Export
          </Button>
          <Link to="/scan" search={{ batch: id }}>
            <Button>
              <Plus className="size-4" /> Scan next product
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Tile label={STATUS_LABEL.compliant} value={counts.compliant} tone="bg-success/12 text-success" />
        <Tile label={STATUS_LABEL.needs_review} value={counts.review} tone="bg-warning/15 text-warning" />
        <Tile
          label={STATUS_LABEL.non_compliant}
          value={counts.failed}
          tone="bg-destructive/12 text-destructive"
        />
      </div>

      <h2 className="mt-6 font-display text-lg font-bold">Products in this batch</h2>
      <div className="mt-2 space-y-2">
        {reportsQuery.isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[74px] w-full rounded-xl" />)
        ) : reports.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No products scanned into this batch yet.
              </p>
              <Link to="/scan" search={{ batch: id }} className="mt-3 inline-block">
                <Button>
                  <ScanLine className="size-4" /> Scan the first product
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          reports.map((r, i) => (
            <Link key={r.id} to="/report/$id" params={{ id: r.id }} className="block">
              <Card
                className="shadow-soft transition-shadow hover:shadow-lift animate-fade-up"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">
                    {i + 1}
                  </span>
                  <ScanThumb path={r.scans?.images?.[0] ?? null} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {r.scans?.product_name ?? "Unnamed product"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.scans?.category} · {r.summary ?? ""}
                    </p>
                  </div>
                  <StatusBadge status={r.overall_status} />
                  <ChevronRight className="size-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {reports.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display text-lg font-bold">Batch insights</h2>
          <div className="mt-2">
            <ComplianceCharts reports={reports} />
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-3">
        <span className={`inline-block rounded-lg px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
          {label}
        </span>
        <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
