import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Upload,
  Barcode,
  MapPin,
  Loader2,
  X,
  ArrowLeft,
  ScanLine,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { analyzeLabel } from "@/lib/analysis.functions";
import { prepareImage, getPosition, type PreparedImage } from "@/lib/images";
import { CATEGORIES, type Category } from "@/lib/rules";
import type { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan a product — Nirikshan AI" },
      {
        name: "description",
        content:
          "Capture label photos and check every mandatory declaration under the Legal Metrology Rules, 2011.",
      },
      { property: "og:title", content: "Scan a product — Nirikshan AI" },
      {
        property: "og:description",
        content: "Camera-based label compliance scanning with AI declaration extraction.",
      },
    ],
  }),
  component: ScanPage,
});

const STEPS = [
  "Reading label…",
  "Extracting declarations…",
  "Checking legibility and prominence…",
  "Matching against Legal Metrology Rules, 2011…",
];

function ScanPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeLabel);

  const [category, setCategory] = useState<Category>("Food");
  const [imported, setImported] = useState(false);
  const [multiPack, setMultiPack] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [productName, setProductName] = useState("");
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [geoError, setGeoError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1600);
    return () => clearInterval(t);
  }, [running]);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const prepared = await Promise.all(Array.from(files).slice(0, 3).map((f) => prepareImage(f)));
      setImages((prev) => [...prev, ...prepared].slice(0, 3));
    } catch {
      toast.error("Could not read that image. Try another photo.");
    }
  };

  const lookupBarcode = async (code: string) => {
    const trimmed = code.trim();
    if (trimmed.length < 6) return;
    const { data } = await supabase
      .from("products")
      .select("name,category")
      .eq("barcode", trimmed)
      .maybeSingle();
    if (data) {
      setProductName(data.name);
      if (CATEGORIES.includes(data.category as Category)) setCategory(data.category as Category);
      toast.success(`Matched: ${data.name}. Label photos will still be analysed.`);
    } else {
      toast.info("Barcode not in the repository — the label will be read from scratch.");
    }
  };

  const runScan = async () => {
    if (!images.length) {
      toast.error("Add at least one photo of the label.");
      return;
    }
    setRunning(true);
    setStep(0);
    try {
      const position = await getPosition();
      if (!position) setGeoError("Location unavailable — the report will be saved without coordinates.");

      const result = await analyze({
        data: {
          images: images.map((i) => i.dataUrl),
          category,
          imported,
          multiPack,
        },
      });

      const uid = session!.user.id;
      const folder = `${uid}/${crypto.randomUUID()}`;
      const paths: string[] = [];
      for (const img of images) {
        const path = `${folder}/${img.name}`;
        const { error } = await supabase.storage
          .from("scan-images")
          .upload(path, img.blob, { contentType: "image/jpeg" });
        if (!error) paths.push(path);
      }

      const { data: scan, error: scanError } = await supabase
        .from("scans")
        .insert({
          user_id: uid,
          product_name: productName.trim() || result.productName || "Unnamed product",
          category,
          barcode: barcode.trim() || null,
          images: paths,
          lat: position?.coords.latitude ?? null,
          lng: position?.coords.longitude ?? null,
        })
        .select("id")
        .single();
      if (scanError || !scan) throw new Error("Could not save the scan.");

      const { data: report, error: reportError } = await supabase
        .from("reports")
        .insert({
          scan_id: scan.id,
          user_id: uid,
          overall_status: result.status,
          fields: result.fields as unknown as Json,
          nutrition: (result.nutrition ?? null) as unknown as Json,
          summary: `${result.fields.filter((f) => f.verdict === "pass").length} of ${result.fields.length} applicable declarations compliant.`,
        })
        .select("id")
        .single();
      if (reportError || !report) throw new Error("Could not save the report.");

      if (barcode.trim() && (productName.trim() || result.productName)) {
        await supabase
          .from("products")
          .upsert(
            {
              barcode: barcode.trim(),
              name: productName.trim() || result.productName!,
              category,
            },
            { onConflict: "barcode" },
          );
      }

      await supabase.from("audit_events").insert({
        user_id: uid,
        action: "scan_completed",
        entity: "report",
        entity_id: report.id,
        details: { status: result.status, category },
      });

      void navigate({ to: "/report/$id", params: { id: report.id } });
    } catch (e) {
      setRunning(false);
      toast.error(e instanceof Error ? e.message : "The scan could not be completed.");
    }
  };

  if (running) return <AnalyzingScreen step={step} images={images} />;

  return (
    <AppShell>
      <Button variant="ghost" className="mb-2 -ml-2" onClick={() => navigate({ to: "/dashboard" })}>
        <ArrowLeft className="size-4" /> Back
      </Button>
      <h1 className="font-display text-2xl font-bold">Scan a product</h1>
      <p className="text-sm text-muted-foreground">
        Capture the front label, back label and MRP sticker for the most accurate result.
      </p>

      <Card className="mt-4 shadow-soft animate-fade-up">
        <CardContent className="space-y-4 p-4">
          <div>
            <Label>Product category</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    category === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Only the declarations required for this category will be checked.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-medium">Imported product</p>
              <p className="text-xs text-muted-foreground">Adds the country of origin check.</p>
            </div>
            <Switch checked={imported} onCheckedChange={setImported} />
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-medium">Multi-piece pack</p>
              <p className="text-xs text-muted-foreground">Adds the unit sale price check.</p>
            </div>
            <Switch checked={multiPack} onCheckedChange={setMultiPack} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="barcode"
                inputMode="numeric"
                placeholder="8901058000108"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
              />
              <Button variant="secondary" onClick={() => lookupBarcode(barcode)}>
                <Barcode className="size-4" /> Match
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pname">Product name (optional)</Label>
            <Input
              id="pname"
              placeholder="Read from the label if left blank"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 shadow-soft animate-fade-up">
        <CardContent className="p-4">
          <Label>Label photos ({images.length}/3)</Label>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={img.name} className="relative aspect-square overflow-hidden rounded-xl border">
                <img src={img.dataUrl} alt={`Label ${i + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-background/90"
                  onClick={() => setImages((prev) => prev.filter((p) => p.name !== img.name))}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {images.length < 3 && (
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="grid aspect-square place-items-center rounded-xl border border-dashed text-muted-foreground transition-colors hover:bg-muted"
              >
                <Camera className="size-6" />
              </button>
            )}
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void addFiles(e.target.files)}
          />
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void addFiles(e.target.files)}
          />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => cameraRef.current?.click()}>
              <Camera className="size-4" /> Take photo
            </Button>
            <Button variant="secondary" onClick={() => uploadRef.current?.click()}>
              <Upload className="size-4" /> Upload image
            </Button>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            Your location and the time of scan are recorded with the report as enforcement evidence.
            If you decline location access, the scan still works without coordinates.
          </p>
          {geoError && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="size-3.5" /> {geoError}
            </p>
          )}
        </CardContent>
      </Card>

      <Button className="mt-4 h-13 w-full py-4 text-base" onClick={runScan} disabled={!images.length}>
        <ScanLine className="size-5" /> Analyse label
      </Button>
    </AppShell>
  );
}

function AnalyzingScreen({ step, images }: { step: number; images: PreparedImage[] }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-hero-gradient px-6 text-primary-foreground">
      <div className="relative aspect-square w-64 overflow-hidden rounded-3xl border-2 border-primary-foreground/30 shadow-lift">
        {images[0] && <img src={images[0].dataUrl} alt="" className="size-full object-cover" />}
        <div className="absolute inset-0 bg-scan-sheen animate-sweep" />
        <div className="absolute inset-3 rounded-2xl border-2 border-dashed border-primary-foreground/50" />
      </div>
      <div className="mt-8 flex items-center gap-2 text-base font-semibold">
        <Loader2 className="size-5 animate-spin" />
        {STEPS[step]}
      </div>
      <div className="mt-4 flex gap-1.5">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === step ? "w-8 bg-primary-foreground" : "w-3 bg-primary-foreground/35",
            )}
          />
        ))}
      </div>
      <p className="mt-6 max-w-xs text-center text-xs text-primary-foreground/75">
        Nirikshan AI is reading each mandatory declaration and judging both presence and legibility.
      </p>
    </div>
  );
}
