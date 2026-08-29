#!/usr/bin/env node
/**
 * VedicUpchar — MISSING MEDIA FETCHER
 * ───────────────────────────────────
 *   npm run media:check     # sirf report — kaunsi file missing hai
 *   npm run media:fetch     # missing files ko source se download kare
 *
 * DB me jitne bhi /uploads/... references hain unko uploads/ folder se
 * match karta hai. Jo file missing ho, use SOURCE_MEDIA_URL (ya pehle wale
 * cloud storage) se download karne ki koshish karta hai.
 *
 * .env me optional:
 *   SOURCE_MEDIA_URL=https://<purani-site>/storage/v1/object/public
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const UPLOADS = process.env.UPLOAD_DIR || path.join(ROOT, "uploads");
const SOURCE = (process.env.SOURCE_MEDIA_URL || "").replace(/\/$/, "");
const FETCH = process.argv.includes("--fetch");

const log = (m) => console.log(`\x1b[36m▸\x1b[0m ${m}`);
const ok = (m) => console.log(`\x1b[32m✔\x1b[0m ${m}`);
const warn = (m) => console.log(`\x1b[33m⚠\x1b[0m ${m}`);

const HOST = (process.env.DB_HOST || "127.0.0.1").toLowerCase() === "localhost"
  ? "127.0.0.1" : (process.env.DB_HOST || "127.0.0.1");

async function run() {
  const conn = await mysql.createConnection({
    host: HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [tables] = await conn.query(
    "SELECT table_name t, column_name c FROM information_schema.columns WHERE table_schema = ? AND data_type IN ('varchar','text','mediumtext','longtext','json')",
    [process.env.DB_NAME]
  );

  const refs = new Set();
  for (const { t, c } of tables) {
    try {
      const [rows] = await conn.query(`SELECT \`${c}\` v FROM \`${t}\``);
      for (const r of rows) {
        if (!r.v) continue;
        const s = typeof r.v === "string" ? r.v : JSON.stringify(r.v);
        if (!s.includes("/uploads/")) continue;
        for (const m of s.matchAll(/\/uploads\/[A-Za-z0-9._\/-]+/g)) refs.add(m[0]);
      }
    } catch { /* skip unreadable column */ }
  }

  const missing = [];
  for (const ref of refs) {
    const file = path.join(UPLOADS, ref.replace(/^\/uploads\//, ""));
    if (!fs.existsSync(file)) missing.push(ref);
  }

  log(`${refs.size} media reference(s) mile — ${refs.size - missing.length} present, ${missing.length} missing`);
  if (!missing.length) { ok("Saari media files maujood hain"); await conn.end(); return; }

  fs.writeFileSync(path.join(ROOT, "missing-media.txt"), missing.join("\n"));
  warn(`Missing list likh di: missing-media.txt`);

  if (!FETCH) { await conn.end(); return; }
  if (!SOURCE) { warn(".env me SOURCE_MEDIA_URL set karo tabhi download ho payega"); await conn.end(); return; }

  let done = 0;
  for (const ref of missing) {
    const rel = ref.replace(/^\/uploads\//, "");
    const dest = path.join(UPLOADS, rel);
    try {
      const res = await fetch(`${SOURCE}/${rel}`);
      if (!res.ok) { warn(`${res.status} ${ref}`); continue; }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      done++;
    } catch (e) { warn(`${ref} → ${e.message}`); }
  }
  ok(`${done}/${missing.length} file(s) download ho gayi`);
  await conn.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
