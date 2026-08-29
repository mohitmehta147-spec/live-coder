import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

r.get("/", async (_req, res, next) => {
  try { res.json(await q("SELECT * FROM impact_stats ORDER BY sort_order")); }
  catch (e) { next(e); }
});

r.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = req.body.id || uuid();
    const b = { id, ...req.body };
    const keys = Object.keys(b);
    await q(`INSERT INTO impact_stats (${keys.map(k=>`\`${k}\``).join(",")}) VALUES (${keys.map(()=>"?").join(",")})`,
      keys.map(k => b[k]));
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

r.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = req.body;
    const keys = Object.keys(b);
    await q(`UPDATE impact_stats SET ${keys.map(k=>`\`${k}\`=?`).join(",")} WHERE id=?`,
      [...keys.map(k => b[k]), req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try { await q("DELETE FROM impact_stats WHERE id=?", [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

export default r;
