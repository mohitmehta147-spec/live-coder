import express from "express";
import cors from "cors";
import compression from "compression";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { DB_HOST, testDbConnection, pool } from "./db.js";
import { ensureAdmin, ensureOrderSequence, ensureSchema } from "./bootstrap.js";
import { startEmailWorker } from "./jobs/email-worker.js";

// Routes (real REST — no Supabase)
import authRouter          from "./routes/auth.js";
import otpRouter           from "./routes/otp.js";
import productsRouter      from "./routes/products.js";
import categoriesRouter    from "./routes/categories.js";
import bannersRouter       from "./routes/banners.js";
import blogsRouter         from "./routes/blogs.js";
import ordersRouter        from "./routes/orders.js";
import addressesRouter     from "./routes/addresses.js";
import reviewsRouter       from "./routes/reviews.js";
import consultationsRouter from "./routes/consultations.js";
import contactRouter       from "./routes/contact.js";
import newsletterRouter    from "./routes/newsletter.js";
import couponsRouter       from "./routes/coupons.js";
import offersRouter        from "./routes/offers.js";
import returnsRouter       from "./routes/returns.js";
import leadsRouter         from "./routes/leads.js";
import testimonialsRouter  from "./routes/testimonials.js";
import announcementsRouter from "./routes/announcements.js";
import impactRouter        from "./routes/impact-stats.js";
import mediaRouter         from "./routes/media-logos.js";
import settingsRouter      from "./routes/settings.js";
import uploadRouter        from "./routes/upload.js";
import razorpayRouter      from "./routes/razorpay.js";
import emailRouter         from "./routes/email.js";
import adminRouter         from "./routes/admin.js";
import profilesRouter      from "./routes/profiles.js";
import restRouter          from "./routes/rest.js";
import functionsRouter     from "./routes/functions.js";
import rpcRouter           from "./routes/rpc.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");   // project root (single deployable app)
const app = express();

app.set("trust proxy", 1);
app.use(compression());
app.use(cors({
  origin: (process.env.CORS_ORIGIN || "*").split(",").map(s => s.trim()),
  credentials: true,
}));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// ---------------------------------------------------------------- uploads ---
const UPLOAD_DIR = config.UPLOAD_DIR;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "30d", immutable: false }));

// Fallback chain for /uploads/* when the exact file is not on disk:
//   1) same basename anywhere inside UPLOAD_DIR (folder ka naam DB me alag ho sakta hai)
//   2) cloud storage mirror (agar reachable ho) + local copy cache
//   3) placeholder image (200) — taaki broken/"corrupt" icon kabhi na dikhe
// Fully self-hosted: no external cloud by default. Set MEDIA_FALLBACK_URL in
// .env only if you keep a mirror of old media somewhere (optional).
const MEDIA_FALLBACK = (process.env.MEDIA_FALLBACK_URL || "").replace(/\/$/, "");
const MEDIA_BUCKETS = (process.env.MEDIA_FALLBACK_BUCKETS ||
  "product-images,products,banners,blog-images,review-images,doctor-images,uploads")
  .split(",").map((s) => s.trim()).filter(Boolean);

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

/** basename -> absolute path index of everything already on disk */
let fileIndex = null;
let fileIndexAt = 0;
function buildFileIndex() {
  const map = new Map();
  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (!map.has(e.name)) map.set(e.name, p);
    }
  };
  walk(UPLOAD_DIR);
  fileIndex = map;
  fileIndexAt = Date.now();
  return map;
}
function findByBasename(name) {
  if (!fileIndex || Date.now() - fileIndexAt > 60_000) buildFileIndex();
  return fileIndex.get(name) || null;
}

app.get("/uploads/*", async (req, res, next) => {
  const rel = decodeURIComponent(req.path.replace(/^\/uploads\//, ""));
  if (!rel || rel.includes("..")) return next();

  // 1) same filename in a different sub-folder
  const local = findByBasename(path.basename(rel));
  if (local) {
    res.set("Cache-Control", "public, max-age=2592000");
    return res.sendFile(local);
  }

  // 2) cloud mirror
  if (MEDIA_FALLBACK) {
    const base = path.basename(rel);
    const candidates = [
      ...MEDIA_BUCKETS.map((b) => `${MEDIA_FALLBACK}/${b}/${rel}`),
      `${MEDIA_FALLBACK}/${rel}`,
      ...MEDIA_BUCKETS.map((b) => `${MEDIA_FALLBACK}/${b}/${base}`),
    ];
    for (const url of candidates) {
      try {
        const ctl = AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;
        const r2 = await fetch(url, ctl ? { signal: ctl } : undefined);
        if (!r2.ok) continue;
        const buf = Buffer.from(await r2.arrayBuffer());
        if (!buf.length) continue;
        res.set("Content-Type", r2.headers.get("content-type") || "application/octet-stream");
        res.set("Cache-Control", "public, max-age=2592000");
        res.send(buf);
        const dest = path.join(UPLOAD_DIR, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFile(dest, buf, () => { fileIndex = null; });
        return;
      } catch { /* try next candidate */ }
    }
  }

  // 3) placeholder instead of a broken image.
  // X-Media-Placeholder lets the admin uploader detect "file is not really
  // there" instead of happily saving a URL that renders a grey box.
  if (IMAGE_EXT.test(rel)) {
    res.set("Content-Type", "image/svg+xml");
    res.set("Cache-Control", "no-store");
    res.set("X-Media-Placeholder", "1");
    res.set("Access-Control-Expose-Headers", "X-Media-Placeholder");
    return res.status(200).send(
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">` +
      `<rect width="800" height="800" fill="#f5f1e8"/>` +
      `<text x="400" y="410" text-anchor="middle" font-family="sans-serif" font-size="34" fill="#b9ad93">Image unavailable</text></svg>`
    );
  }
  next();
});



// Basic rate limit on auth/OTP
const hasBuildRef = { value: false };

const authLimit = rateLimit({ windowMs: 60_000, max: 30 });
app.use("/api/auth", authLimit);
app.use("/api/otp",  authLimit);

// ---------------------------------------------------------------- health ----
// Hit this after every deploy:  curl https://<domain>/api/health
const BOOT_TIME = Date.now();

async function healthReport() {
  const out = {
    ok: true,
    status: "healthy",
    time: new Date().toISOString(),
    uptime_seconds: Math.round((Date.now() - BOOT_TIME) / 1000),
    env: process.env.NODE_ENV || "development",
    node: process.version,
    site_domain: config.SITE_DOMAIN,
    public_url: config.PUBLIC_URL,
    api: { ok: true },
    db: { ok: false, host: DB_HOST, name: process.env.DB_NAME || null },
    uploads: { ok: false, dir: UPLOAD_DIR },
    frontend: { build: hasBuildRef.value ? "present" : "missing" },
  };

  const t0 = Date.now();
  try {
    await testDbConnection();
    out.db.ok = true;
    out.db.latency_ms = Date.now() - t0;
    try {
      const [[row]] = await pool.query(
        "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE()"
      );
      out.db.tables = row?.c ?? null;
    } catch { /* non-fatal */ }
  } catch (e) {
    out.db.ok = false;
    out.db.error = e.code ? `${e.code}: ${e.message}` : e.message;
  }

  try {
    fs.accessSync(UPLOAD_DIR, fs.constants.R_OK | fs.constants.W_OK);
    out.uploads.ok = true;
    // how many media files are actually on disk (helps debug "images missing")
    const idx = buildFileIndex();
    out.uploads.files = idx.size;
    out.uploads.topLevel = fs.readdirSync(UPLOAD_DIR).slice(0, 20);
    out.uploads.sample = [...idx.keys()].slice(0, 5);
  } catch (e) {
    out.uploads.error = e.message;
  }


  out.ok = out.db.ok && out.uploads.ok;
  out.status = out.ok ? "healthy" : "degraded";
  return out;
}

async function healthHandler(_req, res) {
  const report = await healthReport();
  res.setHeader("Cache-Control", "no-store");
  res.status(report.ok ? 200 : 503).json(report);
}

app.get("/api/health", healthHandler);
app.get("/health", healthHandler);

// ---------------------------------------------------------------- API -------
app.use("/api/auth",          authRouter);
app.use("/api/otp",           otpRouter);
app.use("/api/profiles",      profilesRouter);
app.use("/api/products",      productsRouter);
app.use("/api/categories",    categoriesRouter);
app.use("/api/banners",       bannersRouter);
app.use("/api/blogs",         blogsRouter);
app.use("/api/orders",        ordersRouter);
app.use("/api/addresses",     addressesRouter);
app.use("/api/reviews",       reviewsRouter);
app.use("/api/consultations", consultationsRouter);
app.use("/api/contact",       contactRouter);
app.use("/api/newsletter",    newsletterRouter);
app.use("/api/coupons",       couponsRouter);
app.use("/api/offers",        offersRouter);
app.use("/api/returns",       returnsRouter);
app.use("/api/leads",         leadsRouter);
app.use("/api/testimonials",  testimonialsRouter);
app.use("/api/announcements", announcementsRouter);
app.use("/api/impact-stats",  impactRouter);
app.use("/api/media-logos",   mediaRouter);
app.use("/api/settings",      settingsRouter);
app.use("/api/upload",        uploadRouter);
app.use("/api/razorpay",      razorpayRouter);
app.use("/api/email",         emailRouter);
app.use("/api/admin",         adminRouter);
app.use("/api/rest",          restRouter);
app.use("/api/functions",     functionsRouter);
app.use("/api/rpc",           rpcRouter);

// Unknown API path -> JSON 404 (never the SPA shell)
app.use("/api", (_req, res) => res.status(404).json({ error: "not found" }));

// ------------------------------------------------------- sitemap.xml (SEO) --
app.get("/sitemap.xml", async (_req, res) => {
  const base = (process.env.SITE_URL || `https://${process.env.SITE_DOMAIN || "vedicupchar.com"}`).replace(/\/$/, "");
  const statics = ["/", "/products", "/consultation", "/blog", "/contact", "/privacy-policy", "/terms"];
  let urls = statics.map((p) => `  <url><loc>${base}${p}</loc><changefreq>daily</changefreq></url>`);
  try {
    const { q } = await import("./db.js");
    const prods = await q("SELECT slug FROM products WHERE (is_active IS NULL OR is_active=1) AND slug IS NOT NULL");
    const blogs = await q("SELECT slug FROM blogs WHERE (is_published IS NULL OR is_published=1) AND slug IS NOT NULL");
    urls = urls
      .concat(prods.map((r) => `  <url><loc>${base}/product/${r.slug}</loc><changefreq>weekly</changefreq></url>`))
      .concat(blogs.map((r) => `  <url><loc>${base}/blog/${r.slug}</loc><changefreq>monthly</changefreq></url>`));
  } catch (e) { /* DB down -> still serve static routes */ }
  res.type("application/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`
  );
});

// ------------------------------------------ React build (Vite frontend-dist) --
// Hostinger deploys can place the build in a few different spots — probe them all.
const DIST_CANDIDATES = [
  process.env.DIST_DIR && path.resolve(process.env.DIST_DIR),
  path.join(ROOT, "frontend-dist"),
  path.join(process.cwd(), "frontend-dist"),
  path.join(ROOT, "dist"),
  path.join(ROOT, "dist", "client"),
  path.join(process.cwd(), "dist"),
  path.join(process.cwd(), "dist", "client"),
  path.resolve(ROOT, "..", "dist"),
  path.join(ROOT, "build"),
].filter(Boolean);
const DIST_DIR = DIST_CANDIDATES.find((d) => fs.existsSync(path.join(d, "index.html"))) || path.join(ROOT, "frontend-dist");
const hasBuild = fs.existsSync(path.join(DIST_DIR, "index.html"));
hasBuildRef.value = hasBuild;

if (hasBuild) {
  // Hashed assets can be cached hard; index.html must never be cached.
  app.use("/assets", express.static(path.join(DIST_DIR, "assets"), { maxAge: "1y", immutable: true }));
  app.use(express.static(DIST_DIR, { index: false, maxAge: "1h" }));

  // SPA fallback — every non-API, non-upload GET returns index.html
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
} else {
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
    res.status(503).send(
      "<h1>Build missing</h1><p>Run <code>npm install &amp;&amp; npm run build</code> to generate <code>/dist</code>, then restart the app.</p>"
    );
  });
}

app.use((_req, res) => res.status(404).json({ error: "not found" }));
app.use((err, _req, res, _next) => {
  console.error("[err]", err);
  res.status(err.status || 500).json({ error: err.message || "server error" });
});

// Never let a stray async error kill the process (Hostinger shows 503 then).
process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

// Listen FIRST — every slow task (DB connect/import) runs after the port is open,
// otherwise LiteSpeed times out the app and serves a 503.
const server = app.listen(PORT, HOST, () => {
  console.log(`VedicUpchar app (API + React build) on ${HOST}:${PORT}`);
  console.log(`[config] SITE_DOMAIN=${config.SITE_DOMAIN}  CORS=${config.CORS_ORIGIN}`);
  console.log(hasBuild ? `✓ Serving frontend from ${DIST_DIR}` : `! No frontend build found`);
  setImmediate(initBackground);
});
server.on("error", (e) => console.error("[listen error]", e.code, e.message));

async function initBackground() {
  try {
    await testDbConnection();
    console.log(`✓ DB connected: ${process.env.DB_USER}@${DB_HOST}/${process.env.DB_NAME}`);
    await ensureSchema();
    await ensureAdmin();
    await ensureOrderSequence();
    startEmailWorker();
  } catch (e) {
    console.error(`[DB ERROR] ${e.code || ""} ${e.message}`);
    if ((e.message || "").includes("::1"))
      console.error("[DB ERROR] Hostinger IPv6 issue: set DB_HOST=127.0.0.1");
  }
}

