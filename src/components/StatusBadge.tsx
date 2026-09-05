import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type OverallStatus } from "@/lib/rules";

const styles: Record<OverallStatus, string> = {
  compliant: "bg-success/12 text-success border-success/30",
  non_compliant: "bg-destructive/12 text-destructive border-destructive/30",
  needs_review: "bg-warning/15 text-warning border-warning/35",
};

const icons: Record<OverallStatus, typeof CheckCircle2> = {
  compliant: CheckCircle2,
  non_compliant: XCircle,
  needs_review: AlertTriangle,
};

export function StatusBadge({
  status,
  size = "sm",
  className,
}: {
  status: OverallStatus;
  size?: "sm" | "lg";
  className?: string;
}) {
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        styles[status],
        size === "lg" ? "px-4 py-2 text-sm" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <Icon className={size === "lg" ? "size-4.5" : "size-3.5"} />
      {STATUS_LABEL[status]}
    </span>
  );
}
