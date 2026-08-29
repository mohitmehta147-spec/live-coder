// Self-hosted media helper (Hostinger only).
// Har image URL ko local /uploads par point karta hai. Koi bhi external
// (Lovable / Supabase / purani cloud) URL ho to sirf uska filename lekar
// /uploads/<filename> bana deta hai — server basename se file dhoond leta hai.

const EXTERNAL_HINTS = [
  "supabase.co",
  "supabase.in",
  "lovable.app",
  "lovableproject.com",
  "lovable.dev",
  "__l5e",
  "opengraph",
];

export function mediaUrl(input?: string | null): string {
  const u = (input || "").trim();
  if (!u) return "";
  if (u.startsWith("data:") || u.startsWith("blob:")) return u;

  // Already local
  if (u.startsWith("/uploads/")) return u;
  if (u.startsWith("/")) return u;

  const isHttp = /^https?:\/\//i.test(u);
  if (!isHttp) return `/uploads/${u.replace(/^\/+/, "")}`;

  let parsed: URL | null = null;
  try {
    parsed = new URL(u);
  } catch {
    return u;
  }

  const sameOrigin =
    typeof window !== "undefined" && parsed.host === window.location.host;
  if (sameOrigin) return parsed.pathname + parsed.search;

  // Lovable ke placeholder / preview assets ko poori tarah drop kar do
  if (/lovable\.(app|dev)|lovableproject\.com|__l5e|opengraph/i.test(u)) return "";

  const looksExternal = EXTERNAL_HINTS.some((h) => u.includes(h));
  if (!looksExternal) return u; // koi genuine 3rd-party CDN ho to chhedo mat

  const file = parsed.pathname.split("/").filter(Boolean).pop() || "";
  if (!file || !/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(file)) return "";
  return `/uploads/${file}`;
}

export function mediaUrls(list?: (string | null | undefined)[] | null): string[] {
  return (list || []).map((x) => mediaUrl(x)).filter(Boolean) as string[];
}
