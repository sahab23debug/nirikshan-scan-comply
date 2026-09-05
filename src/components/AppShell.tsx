import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, ScanLine, ShieldCheck, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-hero-gradient shadow-soft">
        <ScanLine className="size-5 text-primary-foreground" />
      </span>
      <span className="font-display text-lg font-bold tracking-tight">Nirikshan AI</span>
    </span>
  );
}

export function RoleChip({ role }: { role: "citizen" | "officer" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        role === "officer"
          ? "border-officer/30 bg-officer/10 text-officer"
          : "border-citizen/30 bg-citizen/10 text-citizen",
      )}
    >
      {role === "officer" ? <ShieldCheck className="size-3.5" /> : <UserRound className="size-3.5" />}
      {role === "officer" ? "Officer mode" : "Citizen mode"}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/dashboard">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-2">
            {profile && <RoleChip role={profile.role} />}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={async () => {
                await signOut();
                void navigate({ to: "/" });
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-5">{children}</main>
    </div>
  );
}
