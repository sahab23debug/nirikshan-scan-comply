export interface PreparedImage {
  dataUrl: string;
  blob: Blob;
  name: string;
}

/**
 * Downscale + compress a captured photo so it is fast to upload and to analyse.
 * 1280px on the long edge keeps every declaration readable while cutting the
 * upload and vision payload by roughly 4x versus the original camera frame.
 */
export async function prepareImage(file: File, maxSide = 1280): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("Your browser could not process this image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob =
    canvas instanceof OffscreenCanvas
      ? await canvas.convertToBlob({ type: "image/jpeg", quality: 0.72 })
      : await new Promise<Blob>((resolve, reject) =>
          (canvas as HTMLCanvasElement).toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Image conversion failed"))),
            "image/jpeg",
            0.72,
          ),
        );

  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, blob, name: `${crypto.randomUUID()}.jpg` };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image conversion failed"));
    reader.readAsDataURL(blob);
  });
}

/** Never block the scan on GPS: resolve quickly, cached position is fine. */
export function getPosition(timeout = 3000): Promise<GeolocationPosition | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: GeolocationPosition | null) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    setTimeout(() => done(null), timeout);
    navigator.geolocation.getCurrentPosition(
      (pos) => done(pos),
      () => done(null),
      { enableHighAccuracy: false, timeout, maximumAge: 300000 },
    );
  });
}
