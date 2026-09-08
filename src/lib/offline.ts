import { useEffect, useState } from "react";

const PENDING_KEY = "nirikshan.pending-scans";
const CACHE_PREFIX = "nirikshan.cache.";

export interface PendingScan {
  id: string;
  createdAt: string;
  category: string;
  imported: boolean;
  multiPack: boolean;
  barcode: string | null;
  productName: string | null;
  batchId: string | null;
  lat: number | null;
  lng: number | null;
  /** Compressed data URLs of the captured label photos. */
  images: string[];
}

function read<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — offline queue is best effort */
  }
}

export function listPending(): PendingScan[] {
  return read<PendingScan[]>(PENDING_KEY, []);
}

export function addPending(scan: PendingScan) {
  write(PENDING_KEY, [...listPending(), scan]);
}

export function removePending(id: string) {
  write(
    PENDING_KEY,
    listPending().filter((s) => s.id !== id),
  );
}

/** Remember the last successful server read so the screen still works offline. */
export function cacheSet(key: string, value: unknown) {
  write(CACHE_PREFIX + key, value);
}

export function cacheGet<T>(key: string): T | null {
  return read<T | null>(CACHE_PREFIX + key, null);
}

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}

export function usePendingCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sync = () => setCount(listPending().length);
    sync();
    const t = setInterval(sync, 2000);
    window.addEventListener("storage", sync);
    return () => {
      clearInterval(t);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return count;
}

/** Convert a stored data URL back into an uploadable blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta ?? "")?.[1] ?? "image/jpeg";
  const bin = atob(b64 ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
