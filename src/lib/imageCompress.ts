/**
 * Client-side image compression used by all admin uploaders.
 * Re-encodes images through a canvas so corrupted/huge/HEIC-ish files
 * never reach storage, and previews always render.
 */
export type PreparedImage = { blob: Blob; ext: string; contentType: string };

export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.82
): Promise<PreparedImage> {
  const fallbackExt = (file.name.split(".").pop() || "jpg").toLowerCase();
  const fallback: PreparedImage = { blob: file, ext: fallbackExt, contentType: file.type || "image/jpeg" };

  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return fallback;

  try {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fallback;
    ctx.drawImage(bitmap as any, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob || blob.size === 0) return fallback;
    // Keep the smaller of the two
    if (blob.size >= file.size && file.size > 0) return fallback;
    return { blob, ext: "jpg", contentType: "image/jpeg" };
  } catch {
    return fallback;
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/**
 * Verifies a URL actually loads as an image (used for upload previews).
 * The backend answers missing /uploads/* files with a grey "Image unavailable"
 * placeholder (HTTP 200 + X-Media-Placeholder), so a plain <img> load is not
 * proof the file exists — we HEAD-check the header first.
 */
export async function imageLoads(url: string, timeoutMs = 8000): Promise<boolean> {
  if (!url) return false;
  if (!/^(data:|blob:)/.test(url)) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      const res = await fetch(url, { method: "HEAD", signal: ctl.signal, cache: "no-store" });
      clearTimeout(timer);
      if (!res.ok) return false;
      if (res.headers.get("X-Media-Placeholder")) return false;
    } catch {
      /* HEAD blocked (CORS/opaque) — fall through to the <img> probe */
    }
  }
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 0); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = url;
  });
}
