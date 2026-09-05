import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, UserRound, ScanLine, FileCheck2, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { setRoleIntent, type RoleIntent } from "@/lib/roleIntent";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nirikshan AI — Scan. Verify. Comply." },
      {
        name: "description",
        content:
          "Scan a packaged product label and instantly check it against India's Legal Metrology (Packaged Commodities) Rules, 2011.",
      },
      { property: "og:title", content: "Nirikshan AI — Scan. Verify. Comply." },
      {
        property: "og:description",
        content:
          "Label compliance scanning for Legal Metrology enforcement officers and citizens.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<RoleIntent>("citizen");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !session) return;
    if (!profile) return;
    void navigate({ to: "/dashboard" });
  }, [loading, session, profile, navigate]);

  const signIn = async () => {
    setBusy(true);
    setRoleIntent(role);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) {
      setBusy(false);
      toast.error("Sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden bg-hero-gradient px-4 pb-16 pt-8 text-primary-foreground">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-accent/25 blur-3xl" />
        <div className="mx-auto max-w-5xl">
          <BrandMark className="text-primary-foreground" />
          <div className="mt-10 max-w-xl animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1 text-xs font-semibold">
              <ShieldCheck className="size-3.5" /> Department of Consumer Affairs
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
              Scan. Verify. Comply.
            </h1>
            <p className="mt-3 text-base text-primary-foreground/85">
              Point your camera at any packaged product label. Nirikshan AI reads every mandatory
              declaration under the Legal Metrology (Packaged Commodities) Rules, 2011 and returns a
              shareable compliance report in seconds.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
              {[
                { icon: ScanLine, label: "AI label reading" },
                { icon: FileCheck2, label: "10-point checklist" },
                { icon: MapPin, label: "Geo-tagged evidence" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 p-3"
                >
                  <Icon className="mb-1.5 size-4" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-10 max-w-5xl px-4 pb-16">
        <div className="rounded-3xl border bg-card p-5 shadow-lift animate-fade-up sm:p-7">
          <h2 className="font-display text-xl font-bold">Choose how you'll use Nirikshan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your role decides what you can review. You can sign in with the same Google account.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <RoleCard
              active={role === "officer"}
              onClick={() => setRole("officer")}
              icon={<ShieldCheck className="size-5" />}
              title="I'm an Officer"
              points={[
                "Field enforcement scanning",
                "Full reports repository",
                "Citizen-flagged case queue",
              ]}
              accent="officer"
            />
            <RoleCard
              active={role === "citizen"}
              onClick={() => setRole("citizen")}
              icon={<UserRound className="size-5" />}
              title="I'm a Citizen"
              points={[
                "Check any product you buy",
                "Flag violations to a nearby officer",
                "Product Health Snapshot for food",
              ]}
              accent="citizen"
            />
          </div>

          <Button
            className="mt-6 h-12 w-full text-base"
            onClick={signIn}
            disabled={busy || loading}
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <GoogleGlyph className="size-5" />
            )}
            Continue with Google
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {role === "officer"
              ? "Officers verify a departmental Officer ID once before the dashboard unlocks."
              : "Citizen accounts are created automatically on first sign-in."}
          </p>
        </div>
      </section>
    </div>
  );
}

function RoleCard({
  active,
  onClick,
  icon,
  title,
  points,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  points: string[];
  accent: "officer" | "citizen";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-2xl border p-4 text-left transition-all duration-200 hover:shadow-soft",
        active
          ? accent === "officer"
            ? "border-officer bg-officer/6 ring-2 ring-officer/25"
            : "border-citizen bg-citizen/6 ring-2 ring-citizen/25"
          : "bg-card hover:border-muted-foreground/30",
      )}
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-xl",
          accent === "officer" ? "bg-officer/12 text-officer" : "bg-citizen/12 text-citizen",
        )}
      >
        {icon}
      </span>
      <h3 className="mt-3 font-display text-base font-semibold">{title}</h3>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {points.map((p) => (
          <li key={p}>• {p}</li>
        ))}
      </ul>
    </button>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.68 4.1-5.5 4.1a6.2 6.2 0 1 1 0-12.4c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4 9.6-9.7 0-.7-.1-1.2-.2-1.7H12z"
      />
    </svg>
  );
}
