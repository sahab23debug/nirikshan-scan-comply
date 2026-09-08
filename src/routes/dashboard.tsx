import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ScanLine,
  Search,
  TrendingUp,
  ClipboardList,
  Flag,
  MapPin,
  ChevronRight,
  CheckCheck,
  CloudOff,
  Layers,
  BookMarked,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { ScanThumb } from "@/components/ScanThumb";
import { ComplianceCharts } from "@/components/ComplianceCharts";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { fetchFlags, fetchReports, type ReportRow } from "@/lib/queries";
import { fetchBatches } from "@/lib/repository";
import { useOnline, usePendingCount } from "@/lib/offline";
import { supabase } from "@/integrations/supabase/client";
import { getRoleIntent } from "@/lib/roleIntent";
import emptyScans from "@/assets/empty-scans.png";
import emptyFlags from "@/assets/empty-flags.png";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Nirikshan AI" },
      {
        name: "description",
        content: "Compliance scan history, reports and enforcement analytics in Nirikshan AI.",
      },
      { property: "og:title", content: "Dashboard — Nirikshan AI" },
      {
        property: "og:description",
        content: "Track scans, pass rates and citizen-flagged cases.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/" });
      return;
    }
    if (profile && profile.role !== "officer" && getRoleIntent() === "officer") {
      void navigate({ to: "/officer-verify" });
    }
  }, [loading, session, profile, navigate]);

  const isOfficer = profile?.role === "officer";

  const online = useOnline();
  const pendingOffline = usePendingCount();
  useOfflineSync(session?.user.id);

  const reportsQuery = useQuery({
    queryKey: ["reports", session?.user.id],
    queryFn: fetchReports,
    enabled: Boolean(session),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  const flagsQuery = useQuery({
    queryKey: ["flags", session?.user.id],
    queryFn: fetchFlags,
    enabled: Boolean(session),
    staleTime: 30_000,
  });
  const batchesQuery = useQuery({
    queryKey: ["batches", session?.user.id],
    queryFn: fetchBatches,
    enabled: Boolean(session),
    staleTime: 30_000,
  });

  const all = reportsQuery.data ?? [];
  const mine = useMemo(
    () => all.filter((r) => r.user_id === session?.user.id),
    [all, session?.user.id],
  );
  const scope = isOfficer ? all : mine;
  const flags = flagsQuery.data ?? [];

  const passRate = scope.length
    ? Math.round((scope.filter((r) => r.overall_status === "compliant").length / scope.length) * 100)
    : 0;
  const pending = scope.filter((r) => r.overall_status === "needs_review").length;
  const pendingFlags = flags.filter((f) => f.status === "pending").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scope;
    return scope.filter((r) =>
      [r.scans?.product_name, r.scans?.category, r.scans?.barcode, r.overall_status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [scope, search]);

  const acknowledge = async (id: string) => {
    const { error } = await supabase
      .from("citizen_flags")
      .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Could not acknowledge this case.");
      return;
    }
    await supabase.from("audit_events").insert({
      user_id: session!.user.id,
      action: "flag_acknowledged",
      entity: "citizen_flag",
      entity_id: id,
    });
    toast.success("Case acknowledged");
    void qc.invalidateQueries({ queryKey: ["flags"] });
  };

  return (
    <AppShell>
      <div className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold">
          {greeting()}, {profile?.full_name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isOfficer
            ? `${profile?.district ?? "Field"} circle · Officer ID ${profile?.officer_id}`
            : "Check any packaged product against India's Legal Metrology rules."}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ScanLine} label={isOfficer ? "Total scans" : "My scans"} value={scope.length} />
        <Stat icon={TrendingUp} label="Pass rate" value={`${passRate}%`} tone="success" />
        <Stat icon={ClipboardList} label="Pending review" value={pending} tone="warning" />
        <Stat
          icon={Flag}
          label={isOfficer ? "Citizen reports" : "Cases I flagged"}
          value={isOfficer ? pendingFlags : flags.length}
          tone="destructive"
        />
      </div>

      {(!online || pendingOffline > 0) && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          <CloudOff className="size-4 shrink-0" />
          {online
            ? `Syncing ${pendingOffline} scan${pendingOffline === 1 ? "" : "s"} captured offline…`
            : "You're offline. Saved reports stay readable and new scans are queued on this device."}
        </p>
      )}

      <Button
        className="mt-4 h-14 w-full text-base animate-pulse-ring"
        onClick={() => navigate({ to: "/scan" })}
      >
        <ScanLine className="size-5" /> Scan a Product
      </Button>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link to="/scan" search={{ batch: undefined }}>
          <Button variant="secondary" className="w-full">
            <Layers className="size-4" /> Batch inspection
          </Button>
        </Link>
        <Link to="/repository">
          <Button variant="secondary" className="w-full">
            <BookMarked className="size-4" /> Product register
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="activity" className="mt-6">
        <TabsList className="w-full">
          <TabsTrigger value="activity" className="flex-1">
            Activity
          </TabsTrigger>
          <TabsTrigger value="batches" className="flex-1">
            Batches
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex-1">
            Reports
          </TabsTrigger>
          <TabsTrigger value="flags" className="flex-1">
            {isOfficer ? "Citizen Reports" : "My Flags"}
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex-1">
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="batches" className="mt-4 space-y-2">
          {(batchesQuery.data ?? []).length === 0 ? (
            <EmptyState
              image={emptyScans}
              title="No batch inspections yet"
              description="Turn on batch inspection while scanning to group several products into one combined report."
              action={
                <Link to="/scan" search={{ batch: undefined }}>
                  <Button>
                    <Layers className="size-4" /> Start a batch
                  </Button>
                </Link>
              }
            />
          ) : (
            (batchesQuery.data ?? []).map((b) => {
              const inBatch = all.filter((r) => r.batch_id === b.id);
              return (
                <Link key={b.id} to="/batch/$id" params={{ id: b.id }} className="block">
                  <Card className="shadow-soft transition-shadow hover:shadow-lift animate-fade-up">
                    <CardContent className="flex items-center gap-3 p-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Layers className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{b.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {inBatch.length} product{inBatch.length === 1 ? "" : "s"} ·{" "}
                          {new Date(b.created_at).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </TabsContent>


        <TabsContent value="activity" className="mt-4 space-y-2">
          {reportsQuery.isLoading ? (
            <ListSkeleton />
          ) : mine.length === 0 ? (
            <EmptyState
              image={emptyScans}
              title="No scans yet"
              description="Scan your first packaged product label to build your compliance history."
              action={
                <Button onClick={() => navigate({ to: "/scan" })}>
                  <ScanLine className="size-4" /> Start a scan
                </Button>
              }
            />
          ) : (
            mine.map((r, i) => <ReportRowCard key={r.id} report={r} index={i} />)
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by product, category, barcode or status"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {reportsQuery.isLoading ? (
            <ListSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState
              image={emptyScans}
              title="No reports match"
              description="Adjust your search, or run a new scan to add a report to the repository."
            />
          ) : (
            filtered.map((r, i) => <ReportRowCard key={r.id} report={r} index={i} />)
          )}
        </TabsContent>

        <TabsContent value="flags" className="mt-4 space-y-2">
          {flags.length === 0 ? (
            <EmptyState
              image={emptyFlags}
              title={isOfficer ? "No citizen reports pending" : "You haven't flagged anything"}
              description={
                isOfficer
                  ? "Cases flagged by citizens in your jurisdiction will land here for acknowledgement."
                  : "If a scan comes back non-compliant, you can send it to the nearest officer from the report screen."
              }
            />
          ) : (
            flags.map((f) => (
              <Card key={f.id} className="shadow-soft animate-fade-up">
                <CardContent className="flex items-center gap-3 p-3">
                  <ScanThumb path={f.reports?.scans?.images?.[0] ?? null} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {f.reports?.scans?.product_name ?? "Unnamed product"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(f.created_at).toLocaleString("en-IN")} · {f.note ?? "No note"}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize">
                      {f.status}
                    </span>
                  </div>
                  {isOfficer && f.status === "pending" && (
                    <Button size="sm" variant="secondary" onClick={() => acknowledge(f.id)}>
                      <CheckCheck className="size-4" /> Acknowledge
                    </Button>
                  )}
                  <Link to="/report/$id" params={{ id: f.report_id }}>
                    <Button size="icon" variant="ghost" aria-label="Open report">
                      <ChevronRight className="size-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="insights" className="mt-4">
          <ComplianceCharts reports={scope} />
          {!isOfficer && (
            <p className="mt-3 text-xs text-muted-foreground">
              Citizens see aggregate insights from their own scans only. Personal details of other
              users are never shared.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function ReportRowCard({ report, index }: { report: ReportRow; index: number }) {
  return (
    <Link to="/report/$id" params={{ id: report.id }} className="block">
      <Card
        className="shadow-soft transition-shadow hover:shadow-lift animate-fade-up"
        style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      >
        <CardContent className="flex items-center gap-3 p-3">
          <ScanThumb path={report.scans?.images?.[0] ?? null} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {report.scans?.product_name ?? "Unnamed product"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {new Date(report.created_at).toLocaleString("en-IN")} · {report.scans?.category}
            </p>
            {report.scans?.lat != null && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="size-3" />
                {report.scans.lat.toFixed(4)}, {report.scans.lng?.toFixed(4)}
              </p>
            )}
          </div>
          <StatusBadge status={report.overall_status} />
        </CardContent>
      </Card>
    </Link>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: typeof ScanLine;
  label: string;
  value: string | number;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/12 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/12 text-destructive",
  } as const;
  return (
    <Card className="shadow-soft animate-fade-up">
      <CardContent className="p-3">
        <span className={`grid size-8 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon className="size-4" />
        </span>
        <p className="mt-2 font-display text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[74px] w-full rounded-xl" />
      ))}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
