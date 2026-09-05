import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/officer-verify")({
  head: () => ({
    meta: [
      { title: "Officer verification — Nirikshan AI" },
      {
        name: "description",
        content: "Verify your Legal Metrology Officer ID to unlock the enforcement dashboard.",
      },
      { property: "og:title", content: "Officer verification — Nirikshan AI" },
      {
        property: "og:description",
        content: "Link a departmental Officer ID to your account to access enforcement tools.",
      },
    ],
  }),
  component: OfficerVerify,
});

function OfficerVerify() {
  const { session, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [officerId, setOfficerId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
    if (profile?.role === "officer") void navigate({ to: "/dashboard" });
  }, [loading, session, profile, navigate]);

  const verify = async () => {
    const id = officerId.trim().toUpperCase();
    if (!id) return;
    setBusy(true);
    const { data: record, error } = await supabase
      .from("officer_registry")
      .select("officer_id,officer_name,district,state,home_lat,home_lng,claimed_by")
      .eq("officer_id", id)
      .maybeSingle();

    if (error || !record) {
      setBusy(false);
      toast.error("That Officer ID is not on the departmental register.");
      return;
    }
    if (record.claimed_by && record.claimed_by !== session?.user.id) {
      setBusy(false);
      toast.error("This Officer ID is already linked to another account.");
      return;
    }

    const { error: claimError } = await supabase
      .from("officer_registry")
      .update({ claimed_by: session!.user.id })
      .eq("officer_id", id);
    if (claimError) {
      setBusy(false);
      toast.error("Could not link this Officer ID. Please try again.");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        role: "officer",
        officer_id: id,
        district: record.district,
        home_lat: record.home_lat,
        home_lng: record.home_lng,
      })
      .eq("id", session!.user.id);

    if (profileError) {
      setBusy(false);
      toast.error("Could not update your profile. Please try again.");
      return;
    }

    await supabase.from("audit_events").insert({
      user_id: session!.user.id,
      action: "officer_verified",
      entity: "profile",
      entity_id: session!.user.id,
      details: { officer_id: id, district: record.district },
    });

    await refreshProfile();
    toast.success(`Verified — welcome, ${record.officer_name}`);
    void navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <BrandMark />
      <div className="mt-6 w-full max-w-md rounded-3xl border bg-card p-6 shadow-lift animate-fade-up">
        <span className="grid size-11 place-items-center rounded-xl bg-officer/12 text-officer">
          <ShieldCheck className="size-5" />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold">Verify your Officer ID</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Officer access is granted only after your departmental ID is matched against the Legal
          Metrology register. This is a one-time step for {profile?.email ?? "your account"}.
        </p>

        <div className="mt-5 space-y-2">
          <Label htmlFor="officer-id">Officer ID</Label>
          <Input
            id="officer-id"
            placeholder="LM-DL-1024"
            value={officerId}
            autoCapitalize="characters"
            onChange={(e) => setOfficerId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void verify()}
          />
          <p className="text-xs text-muted-foreground">
            Demo IDs on the sample register: LM-DL-1024, LM-MH-2087, LM-KA-3312, LM-TN-4450,
            LM-WB-5591, LM-UP-6673.
          </p>
        </div>

        <Button className="mt-5 h-11 w-full" onClick={verify} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
          Verify and unlock dashboard
        </Button>
        <Button
          variant="ghost"
          className="mt-2 h-10 w-full"
          onClick={() => navigate({ to: "/dashboard" })}
        >
          Continue as a citizen instead
        </Button>
      </div>
    </div>
  );
}
