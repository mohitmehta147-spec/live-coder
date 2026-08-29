import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q, tableColumns } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

r.get("/", async (req, res, next) => {
  try {
    const { category_id, search, featured, is_active, limit = 100, offset = 0 } = req.query;
    let sql = "SELECT * FROM products WHERE 1=1";
    const params = [];
    if (is_active !== "all") { sql += " AND (is_active IS NULL OR is_active=1)"; }
    if (category_id) {
      sql += " AND (category_id=? OR (JSON_VALID(category_ids) AND JSON_CONTAINS(category_ids, JSON_QUOTE(?))))";
      params.push(category_id, category_id);
    }
    if (featured)    { sql += " AND is_featured=1"; }
    if (search)      { sql += " AND (name LIKE ? OR description LIKE ? OR sku LIKE ?)"; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    sql += " ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));
    res.json(await q(sql, params));
  } catch (e) { next(e); }
});

r.get("/slug/:slug", async (req, res, next) => {
  try {
    const rows = await q("SELECT * FROM products WHERE slug=? LIMIT 1", [req.params.slug]);
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

r.get("/:id", async (req, res, next) => {
  try {
    const rows = await q("SELECT * FROM products WHERE id=? LIMIT 1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

function serialize(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = (v !== null && typeof v === "object" && !(v instanceof Date)) ? JSON.stringify(v) : v;
  }
  return out;
}

// Drop keys that do not exist as columns in the products table.
// Admin forms send extra/derived fields (category name, variants UI state,
// joined rows); without this filter MySQL throws "Unknown column" and the
// whole save/update fails with a 500.
async function pickColumns(obj) {
  const cols = await tableColumns("products");
  const out = {};
  const dropped = [];
  for (const [k, v] of Object.entries(obj || {})) {
    if (cols.has(k)) out[k] = v;
    else dropped.push(k);
  }
  if (dropped.length) {
    console.warn(`[products] ignoring unknown column(s): ${dropped.join(", ")}`);
  }
  return out;
}

r.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = serialize(await pickColumns({ id: req.body.id || uuid(), ...req.body }));
    delete b.created_at; delete b.updated_at;
    if (!b.id) b.id = uuid();
    const keys = Object.keys(b);
    await q(`INSERT INTO products (${keys.map(k=>`\`${k}\``).join(",")}, created_at, updated_at) VALUES (${keys.map(()=>"?").join(",")}, NOW(), NOW())`,
      keys.map(k => b[k]));
    res.json({ ok: true, id: b.id });
  } catch (e) { next(e); }
});

r.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = serialize(await pickColumns(req.body));
    delete b.id; delete b.created_at; delete b.updated_at;
    const keys = Object.keys(b);
    if (!keys.length) return res.json({ ok: true });
    await q(`UPDATE products SET ${keys.map(k=>`\`${k}\`=?`).join(",")}, updated_at=NOW() WHERE id=?`,
      [...keys.map(k => b[k]), req.params.id]);
    const rows = await q("SELECT * FROM products WHERE id=? LIMIT 1", [req.params.id]);
    res.json(rows[0] ? { ok: true, ...rows[0] } : { ok: true });
  } catch (e) { next(e); }
});

r.post("/:id/duplicate", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const rows = await q("SELECT * FROM products WHERE id=? LIMIT 1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "not found" });
    const src = rows[0];
    const newId = uuid();
    src.id = newId;
    src.name = `${src.name} (Copy)`;
    src.slug = `${src.slug}-copy-${Date.now().toString(36)}`;
    src.is_active = 0;
    delete src.created_at; delete src.updated_at;
    const b = serialize(await pickColumns(src));
    const keys = Object.keys(b);
    await q(`INSERT INTO products (${keys.map(k=>`\`${k}\``).join(",")}, created_at, updated_at) VALUES (${keys.map(()=>"?").join(",")}, NOW(), NOW())`,
      keys.map(k => b[k]));
    res.json({ ok: true, id: newId });
  } catch (e) { next(e); }
});


r.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try { await q("DELETE FROM products WHERE id=?", [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

export default r;
