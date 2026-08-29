import { Router } from "express";
import { q } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

r.get("/", async (_req, res, next) => {
  try { res.json(await q("SELECT * FROM categories WHERE is_active=1 ORDER BY sort_order, name")); }
  catch (e) { next(e); }
});

r.get("/all", async (_req, res, next) => {
  try { res.json(await q("SELECT * FROM categories ORDER BY sort_order, name")); }
  catch (e) { next(e); }
});

r.get("/slug/:slug", async (req, res, next) => {
  try {
    const rows = await q("SELECT * FROM categories WHERE slug=? LIMIT 1", [req.params.slug]);
    res.json(rows[0] || null);
  } catch (e) { next(e); }
});

r.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = { id: req.body.id || (await import("uuid")).v4(), ...req.body };
    const keys = Object.keys(b);
    await q(`INSERT INTO categories (${keys.map(k=>`\`${k}\``).join(",")}) VALUES (${keys.map(()=>"?").join(",")})`,
      keys.map(k => b[k]));
    res.json({ ok: true, id: b.id });
  } catch (e) { next(e); }
});

r.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = req.body; const keys = Object.keys(b);
    await q(`UPDATE categories SET ${keys.map(k=>`\`${k}\`=?`).join(",")}, updated_at=NOW() WHERE id=?`,
      [...keys.map(k => b[k]), req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try { await q("DELETE FROM categories WHERE id=?", [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

export default r;
