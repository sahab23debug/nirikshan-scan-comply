import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { analyzeLabel } from "@/lib/analysis.functions";
import { listPending, removePending, useOnline } from "@/lib/offline";
import { submitScan } from "@/lib/submitScan";
import type { Category } from "@/lib/rules";

/** Uploads and analyses any scans captured while the device was offline. */
export function useOfflineSync(userId: string | undefined) {
  const analyze = useServerFn(analyzeLabel);
  const online = useOnline();
  const qc = useQueryClient();
  const busy = useRef(false);

  useEffect(() => {
    if (!online || !userId || busy.current) return;
    const pending = listPending();
    if (!pending.length) return;

    busy.current = true;
    void (async () => {
      let done = 0;
      for (const scan of pending) {
        try {
          await submitScan(analyze, userId, {
            images: scan.images.map((dataUrl, i) => ({ dataUrl, name: `${scan.id}-${i}.jpg` })),
            category: scan.category as Category,
            imported: scan.imported,
            multiPack: scan.multiPack,
            barcode: scan.barcode,
            productName: scan.productName,
            batchId: scan.batchId,
            lat: scan.lat,
            lng: scan.lng,
          });
          removePending(scan.id);
          done += 1;
        } catch {
          break; // try again on the next reconnect
        }
      }
      busy.current = false;
      if (done) {
        toast.success(`${done} offline scan${done === 1 ? "" : "s"} analysed and saved.`);
        void qc.invalidateQueries({ queryKey: ["reports"] });
      }
    })();
  }, [online, userId, analyze, qc]);
}
