#!/usr/bin/env node
/**
 * Converts the headerless CSV seed files in /data into ready-to-import
 * MySQL .sql files in /data-sql.
 *
 * Why: phpMyAdmin CSV import fails ("Invalid column count in CSV input")
 * whenever the CSV column order does not exactly match the MySQL table
 * (e.g. `profiles` gained password_hash / role columns) or when a field
 * contains embedded newlines. Generated INSERT statements name every column
 * explicitly, so import always works.
 *
 * Usage: node server/scripts/csv-to-sql.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = path.join(root, "data");
const outDir = path.join(root, "data-sql");
const schemaPath = path.join(root, "server", "schema.sql");
const mapPath = path.join(root, "data", "_csv-columns.json");

// Column order of each CSV file (source export order).
const csvColumns = JSON.parse(fs.readFileSync(mapPath, "utf8"));

// Column list of each MySQL table, parsed straight from schema.sql.
function mysqlColumns() {
  const sql = fs.readFileSync(schemaPath, "utf8");
  const re = /CREATE TABLE `(\w+)` \(([\s\S]*?)\n\) ENGINE/g;
  const out = {};
  let m;
  while ((m = re.exec(sql))) {
    out[m[1]] = [...m[2].matchAll(/^\s*`(\w+)`/gm)].map((x) => x[1]);
  }
  return out;
}

function parseCsv(text) {
  const rows = [];
  let row = [], cur = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (ch !== "\r") cur += ch;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r[0] || "").trim() !== "");
}

const JSONISH = new Set([
  "file_urls", "images", "tags", "sizes", "features", "faqs", "benefits",
  "ingredients", "variations", "variant_matrix", "shipping_address", "items",
  "metadata", "row_data",
]);

function pgArrayToJson(v) {
  const inner = v.slice(1, -1).trim();
  if (!inner) return "[]";
  const parts = [];
  let cur = "", inQ = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inQ) {
      if (ch === "\\") { cur += inner[++i] ?? ""; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { parts.push(cur); cur = ""; }
    else cur += ch;
  }
  parts.push(cur);
  return JSON.stringify(parts.map((s) => s.trim()).filter(Boolean));
}

function esc(s) {
  return "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\n/g, "\\n").replace(/\r/g, "") + "'";
}

function value(col, raw) {
  if (raw === undefined || raw === null || raw === "") return "NULL";
  let v = raw;
  if (v === "t") return "1";
  if (v === "f") return "0";
  if (JSONISH.has(col)) {
    const t = v.trim();
    if (t.startsWith("{") && !t.startsWith('{"')) v = pgArrayToJson(t);
  }
  // Postgres timestamps: 2026-06-11 07:42:18.123456+00 -> MySQL DATETIME
  const ts = v.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (ts && /_at$|_from$|_until$|^dob$|_date$/.test(col) && col !== "consultation_date") {
    return esc(`${ts[1]} ${ts[2]}`);
  }
  return esc(v);
}

const my = mysqlColumns();
fs.mkdirSync(outDir, { recursive: true });

let summary = [];
for (const file of fs.readdirSync(dataDir).filter((f) => f.endsWith(".csv"))) {
  const table = path.basename(file, ".csv");
  const srcCols = csvColumns[table];
  const dstCols = my[table];
  if (!srcCols || !dstCols) { summary.push(`skip ${table} (no mapping)`); continue; }

  const rows = parseCsv(fs.readFileSync(path.join(dataDir, file), "utf8"));
  const useCols = srcCols.filter((c) => dstCols.includes(c));
  const lines = [
    `-- ${table}: ${rows.length} rows`,
    `SET FOREIGN_KEY_CHECKS=0;`,
    `SET NAMES utf8mb4;`,
  ];
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const tuples = chunk.map((r) => {
      const rec = {};
      srcCols.forEach((c, idx) => { rec[c] = r[idx]; });
      return "(" + useCols.map((c) => value(c, rec[c])).join(",") + ")";
    });
    lines.push(
      `INSERT IGNORE INTO \`${table}\` (${useCols.map((c) => "`" + c + "`").join(",")}) VALUES\n` +
      tuples.join(",\n") + ";"
    );
  }
  lines.push(`SET FOREIGN_KEY_CHECKS=1;`);
  fs.writeFileSync(path.join(outDir, `${table}.sql`), lines.join("\n") + "\n");
  summary.push(`${table}: ${rows.length} rows -> data-sql/${table}.sql`);
}

// One combined file for a single-shot import.
const combined = fs.readdirSync(outDir).filter((f) => f.endsWith(".sql") && f !== "_all.sql")
  .map((f) => fs.readFileSync(path.join(outDir, f), "utf8")).join("\n");
fs.writeFileSync(path.join(outDir, "_all.sql"), combined);

console.log(summary.join("\n"));
console.log(`\nWrote ${summary.length} files to data-sql/ (plus _all.sql)`);
