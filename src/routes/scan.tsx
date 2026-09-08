import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
  Layers,
  CloudOff,
  CheckCircle2,
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
import { findApprovedByBarcode } from "@/lib/repository";
import { submitScan } from "@/lib/submitScan";
import { addPending, useOnline } from "@/lib/offline";
import { CATEGORIES, type Category, type DeclarationKey } from "@/lib/rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scan")({
  validateSearch: (search: Record<string, unknown>) => ({
    batch: typeof search['batch'] === "string" ? (search['batch'] as string) : undefined,
  }),
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
  const { batch: batchParam } = Route.useSearch();
  const analyze = useServerFn(analyzeLabel);
  const online = useOnline();

  const [category, setCategory] = useState<Category>("Food");
  const [imported, setImported] = useState(false);
  const [multiPack, setMultiPack] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [productName, setProductName] = useState("");
  const [expected, setExpected] = useState<Partial<Record<DeclarationKey, string>>>({});
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [batchMode, setBatchMode] = useState(Boolean(batchParam));
  const [batchId, setBatchId] = useState<string | null>(batchParam ?? null);
  const [batchCount, setBatchCount] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!batchParam) return;
    setBatchMode(true);
    setBatchId(batchParam);
    void supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchParam)
      .then(({ count }) => setBatchCount(count ?? 0));
  }, [batchParam]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1400);
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
    if (trimmed.length < 6) {
      toast.info("Enter the full barcode number to match it.");
      return;
    }
    try {
      const product = await findApprovedByBarcode(trimmed);
      if (product) {
        setProductName(product.name);
        setCategory(product.category);
        setImported(product.imported);
        setMultiPack(product.multi_pack);
        setExpected(product.declarations ?? {});
        setMatchedName(product.name);
        toast.success(`Matched ${product.name} in the approved register — declarations prefilled.`);
        return;
      }
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
        toast.info("Barcode not in the register — the label will be read from scratch.");
      }
    } catch {
      toast.error("Could not reach the register right now.");
    }
  };

  const resetForNext = () => {
    setImages([]);
    setBarcode("");
    setProductName("");
    setExpected({});
    setMatchedName(null);
  };

  const ensureBatch = async (uid: string) => {
    if (batchId) return batchId;
    const { data, error } = await supabase
      .from("scan_batches")
      .insert({
        user_id: uid,
        title: `Inspection ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("Could not start the batch inspection.");
    setBatchId(data.id);
    return data.id;
  };

  const runScan = async () => {
    if (!images.length) {
      toast.error("Add at least one photo of the label.");
      return;
    }
    const uid = session!.user.id;

    // Offline: queue the scan locally and sync it the moment the network returns.
    if (!online) {
      addPending({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        category,
        imported,
        multiPack,
        barcode: barcode.trim() || null,
        productName: productName.trim() || null,
        batchId,
        lat: null,
        lng: null,
        images: images.map((i) => i.dataUrl),
      });
      toast.success("Saved offline. It will be analysed automatically once you're back online.");
      resetForNext();
      return;
    }

    setRunning(true);
    setStep(0);
    try {
      const activeBatch = batchMode ? await ensureBatch(uid) : null;
      const position = await getPosition();
      if (!position) setGeoError("Location unavailable — the report is saved without coordinates.");

      const { reportId } = await submitScan(analyze, uid, {
        images,
        category,
        imported,
        multiPack,
        barcode: barcode.trim() || null,
        productName: productName.trim() || null,
        batchId: activeBatch,
        lat: position?.coords.latitude ?? null,
        lng: position?.coords.longitude ?? null,
        expected,
      });

      setRunning(false);
      if (activeBatch) {
        setBatchCount((c) => c + 1);
        resetForNext();
        toast.success("Product added to this batch inspection.");
        return;
      }
      void navigate({ to: "/report/$id", params: { id: reportId } });
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

      {!online && (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          <CloudOff className="size-4 shrink-0" />
          You're offline. Photos and product details are saved on this device and analysed
          automatically when the connection returns.
        </p>
      )}

      <Card className="mt-4 shadow-soft animate-fade-up">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Layers className="size-4" /> Batch inspection
              </p>
              <p className="text-xs text-muted-foreground">
                Scan several products in one visit and get one combined report.
              </p>
            </div>
            <Switch
              checked={batchMode}
              onCheckedChange={(v) => setBatchMode(v)}
              disabled={Boolean(batchId)}
            />
          </div>
          {batchMode && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/60 p-3">
              <p className="text-xs font-medium">
                {batchCount} product{batchCount === 1 ? "" : "s"} in this batch
              </p>
              {batchId && (
                <Link to="/batch/$id" params={{ id: batchId }}>
                  <Button size="sm" variant="secondary">
                    <CheckCircle2 className="size-4" /> Finish batch
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
              <Button variant="secondary" onClick={() => lookupBarcode(barcode)} disabled={!online}>
                <Barcode className="size-4" /> Match
              </Button>
            </div>
            {matchedName && (
              <p className="text-xs text-success">
                Registered product “{matchedName}” — the label will also be cross-checked against
                its approved declarations.
              </p>
            )}
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
        <ScanLine className="size-5" />
        {!online ? "Save scan for later" : batchMode ? "Analyse & add to batch" : "Analyse label"}
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
