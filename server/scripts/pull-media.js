#!/usr/bin/env node
/**
 * VedicUpchar — ONE-TIME BULK MEDIA PULL
 * ──────────────────────────────────────
 * Saara cloud media (Supabase storage mirror) ek baar me local UPLOAD_DIR
 * me utaar deta hai, taaki MEDIA_FALLBACK_URL hata kar site fully
 * self-hosted ho jaaye.
 *
 *   node server/scripts/pull-media.js            # DB se paths (Hostinger par)
 *   node server/scripts/pull-media.js --from-api # live site API se paths
 *   node server/scripts/pull-media.js --api-base https://vedicupchar.com
 *
 * Source order har file ke liye:
 *   MEDIA_FALLBACK_URL/<bucket>/<rel>  →  MEDIA_FALLBACK_URL/<rel>
 *   →  MEDIA_FALLBACK_URL/<bucket>/<basename>  →  API_BASE/uploads/<rel>
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const UPLOADS = path.resolve(process.env.UPLOAD_DIR || path.join(ROOT, "uploads"));
const FALLBACK = (process.env.MEDIA_FALLBACK_URL || "").replace(/\/$/, "");
const BUCKETS = (
  process.env.MEDIA_FALLBACK_BUCKETS ||
  "product-images,products,banners,blog-images,review-images,doctor-images,uploads"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const argv = process.argv.slice(2);
const FROM_API = argv.includes("--from-api");
const API_BASE = (
  argv[argv.indexOf("--api-base") + 1]?.startsWith("http")
    ? argv[argv.indexOf("--api-base") + 1]
    : process.env.SITE_URL || "https://vedicupchar.com"
).replace(/\/$/, "");

const API_PATHS = [
  "/api/products?limit=1000",
  "/api/banners",
  "/api/blogs?limit=500",
  "/api/categories",
  "/api/testimonials",
  "/api/media-logos",
  "/api/offers",
  "/api/announcements",
  "/api/impact-stats",
];

const log = (m) => console.log(`\x1b[36m▸\x1b[0m ${m}`);
const ok = (m) => console.log(`\x1b[32m✔\x1b[0m ${m}`);
const warn = (m) => console.log(`\x1b[33m⚠\x1b[0m ${m}`);

const REF = /\/uploads\/[A-Za-z0-9._\-/%]+\.(?:png|jpe?g|webp|gif|avif|svg)/gi;

function collect(text, set) {
  for (const m of text.match(REF) || []) {
    set.add(decodeURIComponent(m.replace(/^\/uploads\//, "")));
  }
}

async function pathsFromApi() {
  const set = new Set();
  for (const p of API_PATHS) {
    try {
      const r = await fetch(API_BASE + p);
      if (!r.ok) {
        warn(`${p} → ${r.status}`);
        continue;
      }
      collect(await r.text(), set);
    } catch (e) {
      warn(`${p} → ${e.message}`);
    }
  }
  return set;
}

async function pathsFromDb() {
  const { default: mysql } = await import("mysql2/promise");
  const host = (process.env.DB_HOST || "127.0.0.1").toLowerCase() === "localhost"
    ? "127.0.0.1"
    : process.env.DB_HOST || "127.0.0.1";
  const conn = await mysql.createConnection({
    host,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const set = new Set();
  const [tables] = await conn.query("SHOW TABLES");
  for (const row of tables) {
    const table = Object.values(row)[0];
    const [rows] = await conn.query(`SELECT * FROM \`${table}\``).catch(() => [[]]);
    for (const r of rows) collect(JSON.stringify(r), set);
  }
  await conn.end();
  return set;
}

async function download(rel) {
  const base = path.basename(rel);
  const candidates = [];
  if (FALLBACK) {
    candidates.push(
      ...BUCKETS.map((b) => `${FALLBACK}/${b}/${rel}`),
      `${FALLBACK}/${rel}`,
      ...BUCKETS.map((b) => `${FALLBACK}/${b}/${base}`),
    );
  }
  candidates.push(`${API_BASE}/uploads/${rel}`);

  for (const url of candidates) {
    try {
      const r = await fetch(url);
      if (!r.ok || r.headers.get("x-media-placeholder")) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (!buf.length) continue;
      const dest = path.join(UPLOADS, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      return buf.length;
    } catch {
      /* next candidate */
    }
  }
  return 0;
}

async function run() {
  fs.mkdirSync(UPLOADS, { recursive: true });
  log(`upload dir : ${UPLOADS}`);
  log(`fallback   : ${FALLBACK || "(none)"}`);

  let refs;
  if (FROM_API) {
    refs = await pathsFromApi();
  } else {
    try {
      refs = await pathsFromDb();
    } catch (e) {
      warn(`DB unavailable (${e.message}) — falling back to live API`);
      refs = await pathsFromApi();
    }
  }
  log(`media references found: ${refs.size}`);

  let saved = 0,
    skipped = 0,
    failed = [];
  const list = [...refs];
  const CONCURRENCY = 8;
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < list.length) {
        const rel = list[i++];
        const dest = path.join(UPLOADS, rel);
        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
          skipped++;
          continue;
        }
        const n = await download(rel);
        if (n) saved++;
        else failed.push(rel);
      }
    }),
  );

  ok(`downloaded ${saved} · already present ${skipped} · missing ${failed.length}`);
  if (failed.length) {
    const report = path.join(ROOT, "media-missing.txt");
    fs.writeFileSync(report, failed.join("\n"));
    warn(`missing list → ${report}`);
  }
  ok("Ho gaya. Ab .env se MEDIA_FALLBACK_URL hata dein aur server restart karein.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
