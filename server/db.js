import mysql from "mysql2/promise";
import "dotenv/config";

const rawDbHost = (process.env.DB_HOST || "").trim();

// Hostinger Node.js sometimes resolves "localhost" to IPv6 ::1.
// Many Hostinger MySQL users are not granted for ::1, which causes:
// Access denied for user 'xxx'@'::1'. Force IPv4 for plug-and-play deploys.
export const DB_HOST = rawDbHost.toLowerCase() === "localhost" ? "127.0.0.1" : rawDbHost;

if (rawDbHost && rawDbHost !== DB_HOST) {
  console.log(`[db] DB_HOST=${rawDbHost} converted to ${DB_HOST} to avoid Hostinger IPv6 (::1)`);
}

export const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 25),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
  charset: "utf8mb4",
  timezone: "+05:30",
  // DECIMAL columns (price, mrp, sale_price, total...) must come back as JS
  // numbers, otherwise the frontend receives "999.00" / "0.00" strings and
  // price math (sale detection, totals) breaks.
  decimalNumbers: true,
});

// Columns that were JSON / text[] in PostgreSQL and are LONGTEXT in MySQL.
// The frontend expects real arrays / objects, so decode them on every read.
// Handles both JSON (`["a","b"]`) and legacy Postgres array literals (`{a,b}`).
export const JSON_COLUMNS = new Set([
  "file_urls", "images", "tags", "sizes", "features", "faqs", "benefits",
  "ingredients", "variations", "variant_matrix", "shipping_address", "items",
  "metadata", "row_data", "payload",
]);

function parsePgArray(text) {
  const inner = text.slice(1, -1).trim();
  if (!inner) return [];
  const out = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inQuotes) {
      if (ch === "\\") { cur += inner[++i] ?? ""; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

export function decodeValue(col, value) {
  if (typeof value !== "string" || !JSON_COLUMNS.has(col)) return value;
  const t = value.trim();
  if (!t || t === "null") return null;
  if (t.startsWith("[") || (t.startsWith("{") && t.endsWith("}") && /^[[{]\s*["\d[{]/.test(t))) {
    try { return JSON.parse(t); } catch { /* fall through */ }
  }
  if (t.startsWith("{") && t.endsWith("}")) {
    try { return JSON.parse(t); } catch { return parsePgArray(t); }
  }
  return value;
}

export function decodeRow(row) {
  if (!row || typeof row !== "object") return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = decodeValue(k, v);
  return out;
}

export function decodeRows(rows) {
  return Array.isArray(rows) ? rows.map(decodeRow) : rows;
}

export async function q(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return Array.isArray(rows) ? decodeRows(rows) : rows;
}

export async function testDbConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

// ---- Per-table column cache (used to drop unknown columns on write) ---------
const columnCache = new Map();

export async function tableColumns(table) {
  if (columnCache.has(table)) return columnCache.get(table);
  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [table]
  );
  const set = new Set(rows.map((r) => r.c));
  columnCache.set(table, set);
  return set;
}

