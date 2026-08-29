import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

// Public: all settings as key/value map
r.get("/", async (_req, res, next) => {
  try {
    const rows = await q("SELECT `key`, value FROM site_settings");
    const map = {};
    for (const row of rows) {
      let v = row.value;
      try { v = JSON.parse(row.value); } catch {}
      map[row.key] = v;
    }
    res.json(map);
  } catch (e) { next(e); }
});

r.get("/:key", async (req, res, next) => {
  try {
    const rows = await q("SELECT * FROM site_settings WHERE `key`=? LIMIT 1", [req.params.key]);
    res.json(rows[0] || null);
  } catch (e) { next(e); }
});

r.put("/:key", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const value = typeof req.body.value === "object" ? JSON.stringify(req.body.value) : String(req.body.value ?? "");
    const existing = await q("SELECT id FROM site_settings WHERE `key`=? LIMIT 1", [req.params.key]);
    if (existing.length) {
      await q("UPDATE site_settings SET value=?, updated_at=NOW() WHERE id=?", [value, existing[0].id]);
    } else {
      await q("INSERT INTO site_settings (id, `key`, value, created_at, updated_at) VALUES (?,?,?,NOW(),NOW())",
        [uuid(), req.params.key, value]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
