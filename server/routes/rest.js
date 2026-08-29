// Generic PostgREST-style endpoint used by the frontend shim.
// Maps supabase.from(table).select/insert/update/delete/upsert to real MySQL.
// URL grammar:
//   GET    /api/rest/:table?select=*&col=eq.value&col2=in.(a,b)&order=col.asc&limit=10&offset=0&single=1
//   POST   /api/rest/:table                      body: row | row[]  (insert)
//   POST   /api/rest/:table?on_conflict=key      body: row | row[]  (upsert)
//   PATCH  /api/rest/:table?col=eq.value         body: partial row  (update)
//   DELETE /api/rest/:table?col=eq.value
// Prefer header "return=representation" returns the affected rows.

import { Router } from "express";
import { pool, q, tableColumns, decodeRows, decodeRow } from "../db.js";
import { optionalAuth } from "../middleware/auth.js";
import { v4 as uuid } from "uuid";

const r = Router();
r.use(optionalAuth);

// ---- Table whitelist (all public tables the frontend needs) ------------------
const TABLES = new Set([
  "announcements","banners","blogs","categories","consultations",
  "contact_inquiries","coupons","email_send_log","email_send_state",
  "email_unsubscribe_tokens","impact_stats","lead_events","media_logos",
  "newsletter_subscribers","offers","order_items","order_sequence","orders",
  "otp_codes","product_reviews","products","profiles","returns",
  "site_settings","suppressed_emails","testimonials","trashed_items",
  "user_addresses","user_roles",
]);

// ---- Access control ----------------------------------------------------------
// Postgres RLS is gone after the MySQL migration, so the same rules are enforced
// here. Without this, anyone could read profiles/otp_codes or delete any table.
const PUBLIC_READ = new Set([
  "products","categories","banners","blogs","announcements","impact_stats",
  "media_logos","offers","coupons","site_settings","testimonials","product_reviews",
]);
// Rows belong to a user: non-admins only ever see/modify their own.
const OWNER_TABLES = new Set([
  "orders","order_items","profiles","user_addresses","consultations","returns",
]);
// Anyone (guest checkout, contact form, reviews...) may insert here.
const ANON_INSERT = new Set([
  "orders","order_items","consultations","contact_inquiries","product_reviews",
  "newsletter_subscribers","lead_events",
]);

async function isAdmin(req) {
  if (!req.user) return false;
  if (req.user.role === "admin") return true;
  try {
    const pr = await q("SELECT role FROM profiles WHERE id=? LIMIT 1", [req.user.sub]);
    if (pr[0]?.role === "admin") { req.user.role = "admin"; return true; }
    const rr = await q("SELECT 1 FROM user_roles WHERE user_id=? AND role='admin' LIMIT 1", [req.user.sub]);
    if (rr.length) { req.user.role = "admin"; return true; }
  } catch { /* ignore */ }
  return false;
}

const phoneOf = (req) => String(req.user?.phone || "").replace(/\D/g, "").slice(-10);

// Older JWTs (and imported accounts) may not carry a phone. Pull it from the
// profile so "my orders" also matches legacy/guest rows placed with that number.
async function hydrateUser(req) {
  if (!req.user || req.user.phone) return;
  try {
    const rows = await q("SELECT phone FROM profiles WHERE id=? OR user_id=? LIMIT 1", [req.user.sub, req.user.sub]);
    if (rows[0]?.phone) req.user.phone = rows[0].phone;
  } catch { /* ignore */ }
}

// Extra WHERE fragment that limits owner tables to the caller's own rows.
function ownerScope(table, req) {
  const uid = req.user?.sub;
  const phone = phoneOf(req);
  switch (table) {
    case "profiles":
      return uid ? { sql: "(`id` = ? OR `user_id` = ?)", params: [uid, uid] } : null;
    case "orders":
      if (!uid) return null;
      return phone
        ? { sql: "(`user_id` = ? OR `customer_phone` LIKE ?)", params: [uid, `%${phone}`] }
        : { sql: "`user_id` = ?", params: [uid] };
    case "order_items":
      if (!uid) return null;
      return {
        sql: "`order_id` IN (SELECT id FROM orders WHERE user_id = ? OR customer_phone LIKE ?)",
        params: [uid, `%${phone}`],
      };
    default:
      return uid ? { sql: "`user_id` = ?", params: [uid] } : null;
  }
}

// Guest reads that must stay open: order success page (?id=) and public order
// tracking (?order_number= & ?customer_phone=).
function guestOrderLookupAllowed(table, query) {
  if (table === "orders") {
    if (query.id) return true;
    return !!(query.order_number && query.customer_phone);
  }
  if (table === "order_items") return !!query.order_id;
  return false;
}

// ---- Column safety -----------------------------------------------------------
const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const safeIdent = (s) => (IDENT.test(String(s)) ? String(s) : null);

// ---- PostgREST filter operators ---------------------------------------------
const OPS = {
  eq:  (c, v) => [`\`${c}\` = ?`,  [coerce(v)]],
  neq: (c, v) => [`\`${c}\` <> ?`, [coerce(v)]],
  gt:  (c, v) => [`\`${c}\` > ?`,  [coerce(v)]],
  gte: (c, v) => [`\`${c}\` >= ?`, [coerce(v)]],
  lt:  (c, v) => [`\`${c}\` < ?`,  [coerce(v)]],
  lte: (c, v) => [`\`${c}\` <= ?`, [coerce(v)]],
  like:  (c, v) => [`\`${c}\` LIKE ?`,  [String(v).replace(/\*/g, "%")]],
  ilike: (c, v) => [`LOWER(\`${c}\`) LIKE LOWER(?)`, [String(v).replace(/\*/g, "%")]],
  is:  (c, v) => v === "null" ? [`\`${c}\` IS NULL`, []] : [`\`${c}\` IS ?`, [coerce(v)]],
  in:  (c, v) => {
    const inner = String(v).replace(/^\(|\)$/g, "");
    const parts = inner.length ? inner.split(",").map(coerce) : [null];
    return [`\`${c}\` IN (${parts.map(() => "?").join(",")})`, parts];
  },
};

function coerce(v) {
  if (v === "null") return null;
  if (v === "true") return 1;
  if (v === "false") return 0;
  return v;
}

function oneFilter(col, value, clauses, params) {
  let negate = false;
  let v = String(value);
  if (v.startsWith("not.")) { negate = true; v = v.slice(4); }
  const m = v.match(/^([a-z]+)\.(.*)$/s);
  if (!m || !OPS[m[1]]) {
    clauses.push(`\`${col}\` ${negate ? "<>" : "="} ?`);
    params.push(coerce(v));
    return;
  }
  const [sql, p] = OPS[m[1]](col, m[2]);
  clauses.push(negate ? `NOT (${sql})` : sql);
  params.push(...p);
}

// PostgREST "or" grammar: or=(col.eq.x,col2.ilike.*y*)
function buildOr(expr) {
  const inner = String(expr).trim().replace(/^\(|\)$/g, "");
  if (!inner) return null;
  const parts = [];
  let depth = 0, cur = "";
  for (const ch of inner) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur) parts.push(cur);
  const clauses = [], params = [];
  for (const part of parts) {
    const idx = part.indexOf(".");
    if (idx < 0) continue;
    const col = safeIdent(part.slice(0, idx));
    if (!col) continue;
    oneFilter(col, part.slice(idx + 1), clauses, params);
  }
  if (!clauses.length) return null;
  return { sql: "(" + clauses.join(" OR ") + ")", params };
}

function buildWhere(query, table) {
  const clauses = [];
  const params = [];
  // Products can belong to several categories (products.category_ids JSON list).
  // A `category_id=eq.X` filter must therefore also match the extra list.
  if (table === "products" && typeof query?.category_id === "string") {
    const val = query.category_id.replace(/^eq\./, "");
    clauses.push("(`category_id` = ? OR JSON_VALID(`category_ids`) AND JSON_CONTAINS(`category_ids`, JSON_QUOTE(?)))");
    params.push(val, val);
    query = { ...query };
    delete query.category_id;
  }
  if (query && query.or) {
    const o = buildOr(query.or);
    if (o) { clauses.push(o.sql); params.push(...o.params); }
  }
  for (const [key, raw] of Object.entries(query || {})) {
    if (["select","order","limit","offset","single","on_conflict","or","count","head"].includes(key)) continue;
    const col = safeIdent(key);
    if (!col) continue;
    oneFilter(col, String(raw), clauses, params);
  }
  return { sql: clauses.length ? " WHERE " + clauses.join(" AND ") : "", params };
}

function buildOrder(orderStr) {
  if (!orderStr) return "";
  const parts = String(orderStr).split(",").map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const [col, dir] = p.split(".");
    const c = safeIdent(col);
    if (!c) continue;
    out.push(`\`${c}\` ${String(dir).toLowerCase() === "desc" ? "DESC" : "ASC"}`);
  }
  return out.length ? " ORDER BY " + out.join(", ") : "";
}

function needsUuid(table)    { return table !== "order_sequence"; }
function needsCreated(_t)    { return true; }
function needsUpdated(table) {
  return ["products","blogs","orders","profiles","site_settings","categories",
          "banners","user_addresses","consultations","product_reviews",
          "coupons","offers","returns"].includes(table);
}

// Sequential order number: VU/DDMMYYYY/0001 (counter is global, never resets —
// matches the numbering that already exists in production data).
async function nextOrderNumber() {
  const today = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }).replace(/\//g, "");
  await q("INSERT INTO order_sequence (date_key, counter) VALUES ('global', 1) ON DUPLICATE KEY UPDATE counter=counter+1");
  const [row] = await q("SELECT counter FROM order_sequence WHERE date_key='global'");
  return `VU/${today}/${String(row?.counter || 1).padStart(4, "0")}`;
}

async function prepInsert(table, row) {
  const cols = await tableColumns(table);
  const out = {};
  // Drop keys that do not exist in MySQL (schema drift between PG and MySQL)
  const dropped = [];
  for (const [k, v] of Object.entries(row || {})) {
    if (cols.has(k)) out[k] = v;
    else dropped.push(k);
  }
  if (dropped.length) {
    console.warn(`[rest] INSERT ${table}: ignoring unknown column(s) -> ${dropped.join(", ")} (add them in server/schema.sql)`);
  }
  if (needsUuid(table) && cols.has("id") && !out.id) out.id = uuid();
  if (table === "orders" && cols.has("order_number") && !out.order_number) {
    out.order_number = await nextOrderNumber();
  }
  const now = new Date();
  if (needsCreated(table) && cols.has("created_at") && out.created_at === undefined) out.created_at = now;
  if (needsUpdated(table) && cols.has("updated_at")) out.updated_at = now;
  // Tables that use non-standard timestamp columns
  if (cols.has("deleted_at") && out.deleted_at === undefined) out.deleted_at = now;
  if (cols.has("expires_at") && out.expires_at === undefined && table === "trashed_items") {
    out.expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  // Serialize objects/arrays for LONGTEXT/JSON columns
  for (const k of Object.keys(out)) {
    if (out[k] !== null && typeof out[k] === "object" && !(out[k] instanceof Date)) {
      out[k] = JSON.stringify(out[k]);
    }
  }
  return out;
}

async function prepUpdate(table, row) {
  const cols = await tableColumns(table);
  const out = {};
  for (const [k, v] of Object.entries(row || {})) if (cols.has(k)) out[k] = v;
  if (needsUpdated(table) && cols.has("updated_at")) out.updated_at = new Date();
  for (const k of Object.keys(out)) {
    if (out[k] !== null && typeof out[k] === "object" && !(out[k] instanceof Date)) {
      out[k] = JSON.stringify(out[k]);
    }
  }
  return out;
}

function wantsRepresentation(req) {
  const p = String(req.get("Prefer") || "").toLowerCase();
  return p.includes("return=representation");
}

// ---- GET (select) ------------------------------------------------------------
r.get("/:table", async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!TABLES.has(table)) return res.status(404).json({ error: "unknown table" });

    // select=col1,col2 — only column names allowed; * ok
    await hydrateUser(req);
    const selectRaw = String(req.query.select || "*");
    let selectSql = "*";
    if (selectRaw !== "*") {
      const cols = selectRaw.split(",").map(s => s.trim()).map(safeIdent).filter(Boolean);
      selectSql = cols.length ? cols.map(c => `\`${c}\``).join(",") : "*";
    }

    const { sql: whereSql, params } = buildWhere(req.query, table);
    // --- access control ---
    let guardSql = whereSql, guardParams = params;
    const admin = await isAdmin(req);
    if (!admin) {
      if (OWNER_TABLES.has(table)) {
        const scope = ownerScope(table, req);
        if (scope) {
          guardSql = whereSql ? `${whereSql} AND ${scope.sql}` : ` WHERE ${scope.sql}`;
          guardParams = [...params, ...scope.params];
        } else if (!guestOrderLookupAllowed(table, req.query)) {
          return res.status(401).json({ error: "auth required" });
        }
      } else if (!PUBLIC_READ.has(table)) {
        return res.status(403).json({ error: "forbidden" });
      }
    }
    const orderSql = buildOrder(req.query.order);
    const limit  = Math.max(0, Math.min(1000, Number(req.query.limit || 0)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const limitSql = limit ? ` LIMIT ${limit}` + (offset ? ` OFFSET ${offset}` : "") : "";

    // count=exact (optionally head=1 for count only)
    if (req.query.count) {
      const [c] = await q(`SELECT COUNT(*) AS n FROM \`${table}\`${guardSql}`, guardParams);
      const count = Number(c?.n || 0);
      if (req.query.head === "1") return res.json({ count, data: [] });
      const data = await q(`SELECT ${selectSql} FROM \`${table}\`${guardSql}${orderSql}${limitSql}`, guardParams);
      return res.json({ count, data });
    }

    const rows = await q(`SELECT ${selectSql} FROM \`${table}\`${guardSql}${orderSql}${limitSql}`, guardParams);
    if (req.query.single === "1") return res.json(rows[0] || null);
    res.json(rows);
  } catch (e) { next(e); }
});

// ---- POST (insert / upsert) -------------------------------------------------
r.post("/:table", async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!TABLES.has(table)) return res.status(404).json({ error: "unknown table" });
    const onConflict = req.query.on_conflict ? String(req.query.on_conflict) : null;

    const body = Array.isArray(req.body) ? req.body : [req.body];
    if (!body.length) return res.json([]);

    // --- access control ---
    const admin = await isAdmin(req);
    if (!admin) {
      if (!ANON_INSERT.has(table) && !(req.user && OWNER_TABLES.has(table)))
        return res.status(403).json({ error: "forbidden" });
      for (const row of body) {
        // Never let a client claim another user's row, or self-approve a review
        if (OWNER_TABLES.has(table) && req.user && "user_id" in (row || {})) row.user_id = req.user.sub;
        if (table === "product_reviews") row.status = "pending";
        if (table === "profiles" && req.user) { row.id = req.user.sub; row.user_id = req.user.sub; }
        if (row) { delete row.role; }
      }
    }

    const rows = [];
    for (const row of body) rows.push(await prepInsert(table, row));
    const cols = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
    const values = rows.map(r => cols.map(c => r[c] ?? null));

    const colSql = cols.map(c => `\`${safeIdent(c)}\``).join(",");
    const placeholders = rows.map(() => `(${cols.map(() => "?").join(",")})`).join(",");
    const flat = values.flat();

    let sql = `INSERT INTO \`${table}\` (${colSql}) VALUES ${placeholders}`;
    if (onConflict) {
      const updates = cols
        .filter(c => c !== "id" && c !== "created_at" && c !== onConflict)
        .map(c => `\`${safeIdent(c)}\`=VALUES(\`${safeIdent(c)}\`)`).join(",");
      if (updates) sql += ` ON DUPLICATE KEY UPDATE ${updates}`;
    }

    const conn = await pool.getConnection();
    try {
      await conn.execute(sql, flat);
      if (!wantsRepresentation(req)) return res.json(rows.length === 1 ? decodeRow(rows[0]) : decodeRows(rows));
      // Return-representation: fetch by ids we generated
      const ids = rows.map(r => r.id).filter(Boolean);
      if (!ids.length) return res.json(decodeRows(rows));
      const [raw] = await conn.execute(
        `SELECT * FROM \`${table}\` WHERE id IN (${ids.map(() => "?").join(",")})`, ids
      );
      const out = decodeRows(raw);
      res.json(rows.length === 1 ? out[0] : out);
    } finally { conn.release(); }
  } catch (e) { next(e); }
});

// ---- PATCH (update) ---------------------------------------------------------
r.patch("/:table", async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!TABLES.has(table)) return res.status(404).json({ error: "unknown table" });
    await hydrateUser(req);
    const { sql: whereSql, params: whereParams } = buildWhere(req.query);
    if (!whereSql) return res.status(400).json({ error: "update requires a filter" });

    // --- access control ---
    let guardSql = whereSql, guardParams = whereParams;
    const admin = await isAdmin(req);
    if (!admin) {
      if (!OWNER_TABLES.has(table)) return res.status(403).json({ error: "forbidden" });
      const scope = ownerScope(table, req);
      if (scope) {
        guardSql = `${whereSql} AND ${scope.sql}`;
        guardParams = [...whereParams, ...scope.params];
      } else if (table === "orders" && req.query.id) {
        // Guest checkout must be able to mark its own order paid/failed
        const allowed = ["status", "payment_status", "payment_id", "payment_method", "notes"];
        req.body = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
      } else {
        return res.status(401).json({ error: "auth required" });
      }
      if (req.body) { delete req.body.role; delete req.body.password_hash; }
    }

    const row = await prepUpdate(table, req.body || {});
    const cols = Object.keys(row);
    if (!cols.length) return res.json([]);
    const setSql = cols.map(c => `\`${safeIdent(c)}\`=?`).join(",");
    const params = [...cols.map(c => row[c]), ...guardParams];
    await q(`UPDATE \`${table}\` SET ${setSql}${guardSql}`, params);
    if (!wantsRepresentation(req)) return res.json({ updated: true });
    const out = await q(`SELECT * FROM \`${table}\`${guardSql}`, guardParams);
    res.json(out);
  } catch (e) { next(e); }
});

// ---- DELETE -----------------------------------------------------------------
r.delete("/:table", async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!TABLES.has(table)) return res.status(404).json({ error: "unknown table" });
    await hydrateUser(req);
    const { sql: whereSql, params } = buildWhere(req.query);
    if (!whereSql) return res.status(400).json({ error: "delete requires a filter" });

    let guardSql = whereSql, guardParams = params;
    const admin = await isAdmin(req);
    if (!admin) {
      if (!OWNER_TABLES.has(table)) return res.status(403).json({ error: "forbidden" });
      const scope = ownerScope(table, req);
      if (!scope) return res.status(401).json({ error: "auth required" });
      guardSql = `${whereSql} AND ${scope.sql}`;
      guardParams = [...params, ...scope.params];
    }
    await q(`DELETE FROM \`${table}\`${guardSql}`, guardParams);
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

export default r;
