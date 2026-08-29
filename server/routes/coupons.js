import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

r.get("/validate/:code", async (req, res, next) => {
  try {
    const rows = await q(
      "SELECT * FROM coupons WHERE code=? AND is_active=1 AND (valid_from IS NULL OR valid_from<=NOW()) AND (valid_until IS NULL OR valid_until>=NOW()) LIMIT 1",
      [String(req.params.code || "").toUpperCase()]
    );
    if (!rows.length) return res.status(404).json({ error: "invalid or expired coupon" });
    const c = rows[0];
    if (c.max_uses && c.used_count >= c.max_uses)
      return res.status(410).json({ error: "coupon usage limit reached" });
    res.json(c);
  } catch (e) { next(e); }
});

r.get("/", requireAuth, requireAdmin, async (_req, res, next) => {
  try { res.json(await q("SELECT * FROM coupons ORDER BY created_at DESC")); }
  catch (e) { next(e); }
});

r.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = req.body.id || uuid();
    const b = { id, ...req.body };
    if (b.code) b.code = String(b.code).toUpperCase();
    const keys = Object.keys(b);
    await q(`INSERT INTO coupons (${keys.map(k=>`\`${k}\``).join(",")}) VALUES (${keys.map(()=>"?").join(",")})`,
      keys.map(k => b[k]));
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

r.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = req.body; const keys = Object.keys(b);
    await q(`UPDATE coupons SET ${keys.map(k=>`\`${k}\`=?`).join(",")}, updated_at=NOW() WHERE id=?`,
      [...keys.map(k => b[k]), req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try { await q("DELETE FROM coupons WHERE id=?", [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

export default r;
