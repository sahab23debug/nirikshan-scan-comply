import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FieldResult, OverallStatus } from "@/lib/rules";

export interface ReportLike {
  created_at: string;
  overall_status: OverallStatus;
  fields: FieldResult[];
}

export function ComplianceCharts({ reports }: { reports: ReportLike[] }) {
  const byDay = buildTimeline(reports);
  const ratio = [
    { name: "Compliant", value: reports.filter((r) => r.overall_status === "compliant").length },
    {
      name: "Non-Compliant",
      value: reports.filter((r) => r.overall_status === "non_compliant").length,
    },
    { name: "Needs Review", value: reports.filter((r) => r.overall_status === "needs_review").length },
  ];
  const ratioColors = ["var(--color-success)", "var(--color-destructive)", "var(--color-warning)"];

  const missingCounts = new Map<string, number>();
  for (const r of reports) {
    for (const f of r.fields ?? []) {
      if (f.verdict === "fail") missingCounts.set(f.label, (missingCounts.get(f.label) ?? 0) + 1);
    }
  }
  const missing = [...missingCounts.entries()]
    .map(([label, count]) => ({ label: shorten(label), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Scans over time</CardTitle>
        </CardHeader>
        <CardContent className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={byDay} margin={{ left: -22, right: 6, top: 6 }}>
              <defs>
                <linearGradient id="scanFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="scans"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#scanFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Compliance outcomes</CardTitle>
        </CardHeader>
        <CardContent className="flex h-52 items-center">
          <ResponsiveContainer width="60%" height="100%">
            <PieChart>
              <Pie data={ratio} dataKey="value" innerRadius={38} outerRadius={64} paddingAngle={3}>
                {ratio.map((entry, i) => (
                  <Cell key={entry.name} fill={ratioColors[i]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="space-y-2 text-sm">
            {ratio.map((r, i) => (
              <li key={r.name} className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: ratioColors[i] }}
                />
                <span className="text-muted-foreground">{r.name}</span>
                <span className="font-semibold">{r.value}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-soft lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Most common failing declarations</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          {missing.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No failing declarations recorded yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={missing} layout="vertical" margin={{ left: 24, right: 12 }}>
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
                <Bar dataKey="count" fill="var(--color-destructive)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: "0.75rem",
  border: "1px solid var(--color-border)",
  background: "var(--color-popover)",
  color: "var(--color-popover-foreground)",
  fontSize: "12px",
};

function shorten(label: string) {
  return label.length > 26 ? `${label.slice(0, 25)}…` : label;
}

function buildTimeline(reports: ReportLike[]) {
  const days: { day: string; scans: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ day: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), scans: 0 });
  }
  const index = new Map(days.map((d, i) => [d.day, i]));
  for (const r of reports) {
    const key = new Date(r.created_at).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
    const i = index.get(key);
    if (i !== undefined && days[i]) days[i]!.scans += 1;
  }
  return days;
}
