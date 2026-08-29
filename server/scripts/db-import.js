#!/usr/bin/env node
/**
 * VedicUpchar — DB IMPORT (restore a snapshot on any server)
 * ─────────────────────────────────────────────────────────
 *   npm run db:import            # schema + all data-sql/*.sql
 *   npm run db:import -- --fresh # DROP existing rows first (TRUNCATE)
 *
 * Reads ./data-sql/*.sql produced by `npm run db:export`, replaces the
 * {{API}} token with this environment's PUBLIC_URL, and verifies the final
 * row counts against data-sql/_manifest.json so nothing is silently missing.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DATA_DIR = path.join(ROOT, "data-sql");
const SCHEMA = path.join(__dirname, "..", "schema.sql");

const FRESH = process.argv.includes("--fresh");

const log = (m) => console.log(`\x1b[36m▸\x1b[0m ${m}`);
const ok = (m) => console.log(`\x1b[32m✔\x1b[0m ${m}`);
const warn = (m) => console.log(`\x1b[33m⚠\x1b[0m ${m}`);
const err = (m) => console.log(`\x1b[31m✖\x1b[0m ${m}`);

const HOST = (process.env.DB_HOST || "127.0.0.1").toLowerCase() === "localhost"
  ? "127.0.0.1" : (process.env.DB_HOST || "127.0.0.1");

// Media base for the {{API}} token.
// Default = "" → relative "/uploads/..." URLs, which work on ANY domain
// (same-origin app). Set MEDIA_BASE_URL (or PUBLIC_URL) only if media is
// served from a different host/CDN.
const PUBLIC_URL = ((process.env.MEDIA_BASE_URL ?? process.env.PUBLIC_URL ?? "") + "")
  .trim()
  .replace(/\/$/, "");

async function run() {
  if (!fs.existsSync(DATA_DIR)) { err("data-sql/ folder missing — run npm run db:export first"); process.exit(1); }

  const conn = await mysql.createConnection({
    host: HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });
  ok(`Connected: ${process.env.DB_USER}@${HOST}/${process.env.DB_NAME}`);

  // 1. Schema
  if (fs.existsSync(SCHEMA)) {
    log("Applying schema.sql (CREATE TABLE IF NOT EXISTS) ...");
    try { await conn.query(fs.readFileSync(SCHEMA, "utf8")); ok("Schema ready"); }
    catch (e) { warn(`Schema: ${e.message}`); }
  }

  // Skip helper dumps like _all.sql — they duplicate the per-table files.
  const files = fs.readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".sql") && !f.startsWith("_"))
    .sort();

  // Expected row counts: _manifest.json if present, else the
  // "-- <table>: N rows" header each exported file carries.
  const manifestPath = path.join(DATA_DIR, "_manifest.json");
  let expectedCounts = {};
  if (fs.existsSync(manifestPath)) {
    expectedCounts = JSON.parse(fs.readFileSync(manifestPath, "utf8")).tables || {};
  } else {
    warn("data-sql/_manifest.json missing — deriving expected row counts from file headers");
    for (const f of files) {
      const head = fs.readFileSync(path.join(DATA_DIR, f), "utf8").slice(0, 200);
      const m = head.match(/--\s*([\w]+):\s*(\d+)\s*rows/);
      if (m) expectedCounts[m[1]] = Number(m[2]);
    }
  }

  if (FRESH) {
    log("--fresh: truncating target tables ...");
    await conn.query("SET FOREIGN_KEY_CHECKS=0");
    for (const f of files) {
      const t = path.basename(f, ".sql");
      try { await conn.query(`TRUNCATE TABLE \`${t}\``); } catch { /* table may not exist */ }
    }
    await conn.query("SET FOREIGN_KEY_CHECKS=1");
  }

  // 2. Data
  let importErrors = 0;
  for (const f of files) {
    const table = path.basename(f, ".sql");
    const sql = fs.readFileSync(path.join(DATA_DIR, f), "utf8").replaceAll("{{API}}", PUBLIC_URL);
    if (!sql.trim()) { continue; }
    try {
      await conn.query(sql);
      ok(`${table}: imported`);
    } catch (e) {
      err(`${table}: ${e.message.slice(0, 160)}`);
      importErrors++;
    }
  }

  // 3. Verify against expected counts
  log("Verifying row counts ...");
  let mismatches = 0;
  const tables = Object.keys(expectedCounts);
  if (!tables.length) warn("No expected row counts available — skipping verification");
  for (const table of tables) {
    const expected = expectedCounts[table];
    try {
      const [[row]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
      if (row.c < expected) { warn(`${table}: ${row.c}/${expected} rows (missing ${expected - row.c})`); mismatches++; }
      else ok(`${table}: ${row.c}/${expected} rows`);
    } catch (e) { err(`${table}: ${e.message.slice(0, 100)}`); mismatches++; }
  }

  await conn.end();
  if (mismatches || importErrors) {
    warn(`IMPORT FINISHED with ${mismatches} short table(s) and ${importErrors} SQL error(s) — re-run with --fresh to rebuild.`);
    process.exit(2);
  }
  ok(`IMPORT COMPLETE — ${tables.length} table(s) verified, all row counts match`);
}

run().catch((e) => { err(e.message); process.exit(1); });
