import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PackagePlus, Search, ShieldCheck, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchApprovedProducts, type ApprovedProduct } from "@/lib/repository";
import {
  CATEGORIES,
  applicableDeclarations,
  type Category,
  type DeclarationKey,
} from "@/lib/rules";
import type { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/repository")({
  head: () => ({
    meta: [
      { title: "Approved product repository — Nirikshan AI" },
      {
        name: "description",
        content:
          "Officer-maintained register of approved packaged products and their declared Legal Metrology values, used to prefill and cross-check scanned labels.",
      },
      { property: "og:title", content: "Approved product repository — Nirikshan AI" },
      {
        property: "og:description",
        content: "Register approved products and their declarations for automatic label cross-checking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RepositoryPage,
});

type Draft = {
  id?: string;
  barcode: string;
  name: string;
  brand: string;
  category: Category;
  imported: boolean;
  multi_pack: boolean;
  declarations: Partial<Record<DeclarationKey, string>>;
};

const emptyDraft: Draft = {
  barcode: "",
  name: "",
  brand: "",
  category: "Food",
  imported: false,
  multi_pack: false,
  declarations: {},
};

function RepositoryPage() {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const isOfficer = Boolean(profile?.role === "officer" && profile.officer_id);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  const { data: products, isLoading } = useQuery({
    queryKey: ["approved-products", search],
    queryFn: () => fetchApprovedProducts(search),
    enabled: Boolean(session),
  });

  const declarations = useMemo(
    () =>
      draft
        ? applicableDeclarations(draft.category, draft.imported, draft.multi_pack)
        : [],
    [draft],
  );

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Give the product a name.");
      return;
    }
    setSaving(true);
    const payload = {
      barcode: draft.barcode.trim() || null,
      name: draft.name.trim(),
      brand: draft.brand.trim() || null,
      category: draft.category,
      imported: draft.imported,
      multi_pack: draft.multi_pack,
      declarations: Object.fromEntries(
        Object.entries(draft.declarations).filter(([, v]) => (v ?? "").trim().length > 0),
      ) as unknown as Json,
      submitted_by: session!.user.id,
      officer_id: profile?.officer_id ?? null,
    };

    const { error } = draft.id
      ? await supabase.from("approved_products").update(payload).eq("id", draft.id)
      : await supabase.from("approved_products").insert(payload);

    setSaving(false);
    if (error) {
      toast.error(
        error.message.includes("duplicate")
          ? "That barcode is already registered."
          : "Could not save this product.",
      );
      return;
    }
    await supabase.from("audit_events").insert({
      user_id: session!.user.id,
      action: draft.id ? "product_updated" : "product_approved",
      entity: "approved_product",
      entity_id: draft.id ?? null,
      details: { name: payload.name, barcode: payload.barcode },
    });
    toast.success(draft.id ? "Product updated." : "Product added to the repository.");
    setDraft(null);
    void qc.invalidateQueries({ queryKey: ["approved-products"] });
  };

  return (
    <AppShell>
      <Button variant="ghost" className="mb-2 -ml-2" onClick={() => navigate({ to: "/dashboard" })}>
        <ArrowLeft className="size-4" /> Back
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Approved product repository</h1>
          <p className="text-sm text-muted-foreground">
            Declarations registered here are used to prefill and cross-check every scanned label.
          </p>
        </div>
        {isOfficer && (
          <Button onClick={() => setDraft({ ...emptyDraft, declarations: {} })}>
            <PackagePlus className="size-4" /> Add product
          </Button>
        )}
      </div>

      {!isOfficer && (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-officer/30 bg-officer/10 px-3 py-2 text-xs text-officer">
          <ShieldCheck className="size-4 shrink-0" />
          Only verified Legal Metrology officers can add approved products. You can search the register.
        </p>
      )}

      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by product, brand or barcode"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {draft && (
        <Card className="mt-4 shadow-soft animate-fade-up">
          <CardContent className="space-y-4 p-4">
            <p className="font-display text-base font-semibold">
              {draft.id ? "Edit approved product" : "New approved product"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Product name</Label>
                <Input
                  id="name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  value={draft.brand}
                  onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bc">Barcode</Label>
                <Input
                  id="bc"
                  inputMode="numeric"
                  value={draft.barcode}
                  onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Category</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraft({ ...draft, category: c })}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      draft.category === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border p-3">
                <span className="text-sm font-medium">Imported product</span>
                <Switch
                  checked={draft.imported}
                  onCheckedChange={(v) => setDraft({ ...draft, imported: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <span className="text-sm font-medium">Multi-piece pack</span>
                <Switch
                  checked={draft.multi_pack}
                  onCheckedChange={(v) => setDraft({ ...draft, multi_pack: v })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold">Approved declarations</p>
              {declarations.map((d) => (
                <div key={d.key} className="space-y-1.5">
                  <Label htmlFor={d.key} className="text-xs">
                    {d.label} <span className="text-muted-foreground">· {d.rule}</span>
                  </Label>
                  {d.key === "manufacturer_details" || d.key === "consumer_care" ? (
                    <Textarea
                      id={d.key}
                      rows={2}
                      placeholder={d.hint}
                      value={draft.declarations[d.key] ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          declarations: { ...draft.declarations, [d.key]: e.target.value },
                        })
                      }
                    />
                  ) : (
                    <Input
                      id={d.key}
                      placeholder={d.hint}
                      value={draft.declarations[d.key] ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          declarations: { ...draft.declarations, [d.key]: e.target.value },
                        })
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />} Save product
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading the register…</p>}
        {!isLoading && !products?.length && (
          <EmptyState
            image={emptyScans}
            title="No approved products yet"
            description="Officers can register a product once and every future scan of that pack is cross-checked against these declarations."
          />
        )}
        {products?.map((p) => (
          <ProductRow
            key={p.id}
            product={p}
            canEdit={isOfficer}
            onEdit={() =>
              setDraft({
                id: p.id,
                barcode: p.barcode ?? "",
                name: p.name,
                brand: p.brand ?? "",
                category: p.category,
                imported: p.imported,
                multi_pack: p.multi_pack,
                declarations: p.declarations ?? {},
              })
            }
          />
        ))}
      </div>
    </AppShell>
  );
}

function ProductRow({
  product,
  canEdit,
  onEdit,
}: {
  product: ApprovedProduct;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const count = Object.keys(product.declarations ?? {}).length;
  return (
    <Card className="shadow-soft">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-semibold">{product.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[product.brand, product.category, product.barcode].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {count} declaration{count === 1 ? "" : "s"} on record
            {product.officer_id ? ` · approved by ${product.officer_id}` : ""}
          </p>
        </div>
        {canEdit && (
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil className="size-4" /> Edit
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
