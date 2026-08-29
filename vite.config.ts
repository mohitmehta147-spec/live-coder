// Standalone Vite config — works both inside Lovable and on Hostinger/any Node host.
// (Previously depended on @lovable.dev/vite-tanstack-config, which is not on npm.)
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

const LIVE_ORIGIN = "https://vedicupchar.com";
const PROXY_PREFIXES = ["/api/", "/uploads/", "/media/"];

// Dev-only proxy: the sandbox preview runs on a different origin than the live
// backend, so direct browser calls to vedicupchar.com are blocked by CORS.
// Forward those paths through the dev server instead (same-origin for the app).
type CacheHit = { at: number; status: number; headers: [string, string][]; body: Buffer };
const proxyCache = new Map<string, CacheHit>();
const CACHE_TTL = { asset: 10 * 60_000, api: 30_000 };

function liveBackendProxy() {
  return {
    name: "live-backend-proxy",
    apply: "serve" as const,
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url: string = req.url || "";
        if (!PROXY_PREFIXES.some((p) => url.startsWith(p))) return next();
        const isAsset = url.startsWith("/uploads/") || url.startsWith("/media/");
        const cacheable = req.method === "GET";
        const ttl = isAsset ? CACHE_TTL.asset : CACHE_TTL.api;
        const key = `${req.method} ${url}`;
        if (cacheable) {
          const hit = proxyCache.get(key);
          if (hit && Date.now() - hit.at < ttl) {
            res.statusCode = hit.status;
            for (const [k, v] of hit.headers) res.setHeader(k, v);
            res.setHeader("x-proxy-cache", "HIT");
            res.end(hit.body);
            return;
          }
        }
        try {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            // Hostinger's image CDN rejects forwarded browser hints with 422
            // ("Invalid source image"), so assets go upstream with clean headers.
            if (["host", "connection", "accept-encoding"].includes(k)) continue;
            if (isAsset && !["range"].includes(k)) continue;
            if (typeof v === "string") headers[k] = v;
          }
          // Asking for webp/avif makes the CDN 422 on files it cannot convert
          // (missing uploads served as SVG placeholders), so request the raw file.
          if (isAsset) headers["accept"] = "*/*";
          const chunks: Buffer[] = [];
          if (req.method !== "GET" && req.method !== "HEAD") {
            for await (const c of req) chunks.push(c as Buffer);
          }
          const upstream = await fetch(`${LIVE_ORIGIN}${url}`, {
            method: req.method,
            headers,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          });
          res.statusCode = upstream.status;
          upstream.headers.forEach((value, key) => {
            if (["content-encoding", "content-length", "transfer-encoding"].includes(key)) return;
            res.setHeader(key, value);
          });
          res.setHeader("access-control-allow-origin", "*");
          // Let the browser reuse images instead of re-fetching on every render.
          res.setHeader(
            "cache-control",
            isAsset ? "public, max-age=86400, immutable" : "private, max-age=30",
          );
          const buf = Buffer.from(await upstream.arrayBuffer());
          if (cacheable && upstream.ok) {
            const headers: [string, string][] = [];
            res.getHeaderNames().forEach((h) => headers.push([h, String(res.getHeader(h))]));
            proxyCache.set(key, { at: Date.now(), status: upstream.status, headers, body: buf });
            if (proxyCache.size > 500) proxyCache.delete(proxyCache.keys().next().value as string);
          }
          if (!cacheable) proxyCache.clear(); // writes invalidate cached reads
          res.setHeader("x-proxy-cache", "MISS");
          res.end(buf);
        } catch (err: any) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: "proxy_failed", message: err?.message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      // Hostinger (Express) serves a static SPA — emit dist/client/index.html
      // instead of the SSR worker bundle. All data fetching is client-side.
      spa: {
        enabled: true,
        maskPath: "/",
        prerender: { enabled: false, outputPath: "/", crawlLinks: false, retryCount: 1 },
      },
    }),
    viteReact(),
    liveBackendProxy(),
  ],
});
