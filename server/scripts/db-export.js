#!/usr/bin/env node
/**
 * VedicUpchar — DB EXPORT (reproducible sync snapshot)
 * ───────────────────────────────────────────────────
 *   npm run db:export
 *
 * Writes one file per table into ./data-sql/<table>.sql containing
 * TRUNCATE-free `INSERT IGNORE` statements, plus ./data-sql/_manifest.json
 * with row counts so an import can be verified record-for-record.
 *
 * Media URLs (https://<your-domain>/uploads/...) are rewritten to the portable
 * token {{API}}/uploads/... so the same dump works on any domain.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "data-sql");

const log = (m) => console.log(`\x1b[36m▸\x1b[0m ${m}`);
const ok = (m) => console.log(`\x1b[32m✔\x1b[0m ${m}`);
const err = (m) => console.log(`\x1b[31m✖\x1b[0m ${m}`);

const HOST = (process.env.DB_HOST || "127.0.0.1").toLowerCase() === "localhost"
  ? "127.0.0.1" : (process.env.DB_HOST || "127.0.0.1");

const PUBLIC_URL = (process.env.PUBLIC_URL || `https://${process.env.SITE_DOMAIN || "vedicupchar.com"}`)
  .replace(/\/$/, "");

function tokenize(v) {
  if (typeof v !== "string") return v;
  return v
    .replaceAll(`${PUBLIC_URL}/uploads/`, "{{API}}/uploads/")
    .replace(/https?:\/\/[^"'\s]*?\/uploads\//g, "{{API}}/uploads/");
}

function sqlValue(conn, v) {
  if (v === null || v === undefined) return "NULL";
  if (v instanceof Date) return conn.escape(v.toISOString().slice(0, 19).replace("T", " "));
  if (Buffer.isBuffer(v)) return conn.escape(v.toString("utf8"));
  if (typeof v === "object") return conn.escape(tokenize(JSON.stringify(v)));
  return conn.escape(tokenize(v));
}

async function run() {
  const conn = await mysql.createConnection({
    host: HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dateStrings: true,
  });
  ok(`Connected: ${process.env.DB_USER}@${HOST}/${process.env.DB_NAME}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const [tables] = await conn.query(
    "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type='BASE TABLE' ORDER BY table_name"
  );

  const manifest = { exported_at: new Date().toISOString(), source: process.env.DB_NAME, tables: {} };
  let total = 0;

  for (const { t } of tables) {
    const [cols] = await conn.query(
      "SELECT COLUMN_NAME AS c FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? ORDER BY ORDINAL_POSITION",
      [t]
    );
    const colNames = cols.map((c) => c.c);
    const [rows] = await conn.query(`SELECT * FROM \`${t}\``);

    const lines = [
      `-- ${t} — ${rows.length} rows — exported ${manifest.exported_at}`,
      `SET FOREIGN_KEY_CHECKS=0;`,
    ];
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK);
      const values = batch
        .map((r) => `(${colNames.map((c) => sqlValue(conn, r[c])).join(",")})`)
        .join(",\n");
      lines.push(
        `INSERT IGNORE INTO \`${t}\` (${colNames.map((c) => `\`${c}\``).join(",")}) VALUES\n${values};`
      );
    }
    lines.push(`SET FOREIGN_KEY_CHECKS=1;`, "");
    fs.writeFileSync(path.join(OUT_DIR, `${t}.sql`), lines.join("\n"), "utf8");

    manifest.tables[t] = rows.length;
    total += rows.length;
    ok(`${t}: ${rows.length} rows → data-sql/${t}.sql`);
  }

  fs.writeFileSync(path.join(OUT_DIR, "_manifest.json"), JSON.stringify(manifest, null, 2));
  await conn.end();
  log(`Manifest written: data-sql/_manifest.json`);
  ok(`EXPORT COMPLETE — ${Object.keys(manifest.tables).length} tables, ${total} rows`);
}

run().catch((e) => { err(e.message); process.exit(1); });
