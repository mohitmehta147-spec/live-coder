import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

r.get("/", async (req, res, next) => {
  try {
    if (req.query.all) return res.json(await q("SELECT * FROM announcements ORDER BY sort_order"));
    res.json(await q(
      "SELECT * FROM announcements WHERE is_active=1 AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>=NOW()) ORDER BY sort_order"
    ));
  } catch (e) { next(e); }
});

r.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = req.body.id || uuid();
    const fields = { id, ...req.body };
    const keys = Object.keys(fields);
    await q(
      `INSERT INTO announcements (${keys.map(k=>`\`${k}\``).join(",")}) VALUES (${keys.map(()=>"?").join(",")})`,
      keys.map(k => fields[k])
    );
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

r.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = req.body;
    const keys = Object.keys(b);
    await q(`UPDATE announcements SET ${keys.map(k=>`\`${k}\`=?`).join(",")}, updated_at=NOW() WHERE id=?`,
      [...keys.map(k => b[k]), req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try { await q("DELETE FROM announcements WHERE id=?", [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

export default r;
