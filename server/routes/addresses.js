import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
const r = Router();

r.get("/", requireAuth, async (req, res, next) => {
  try { res.json(await q("SELECT * FROM user_addresses WHERE user_id=? ORDER BY is_default DESC, created_at DESC", [req.user.sub])); }
  catch (e) { next(e); }
});

r.post("/", requireAuth, async (req, res, next) => {
  try {
    const id = uuid();
    const b = { id, user_id: req.user.sub, ...req.body };
    if (b.is_default) await q("UPDATE user_addresses SET is_default=0 WHERE user_id=?", [req.user.sub]);
    const keys = Object.keys(b);
    await q(`INSERT INTO user_addresses (${keys.map(k=>`\`${k}\``).join(",")}) VALUES (${keys.map(()=>"?").join(",")})`,
      keys.map(k => b[k]));
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

r.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const b = req.body;
    if (b.is_default) await q("UPDATE user_addresses SET is_default=0 WHERE user_id=?", [req.user.sub]);
    const keys = Object.keys(b);
    await q(`UPDATE user_addresses SET ${keys.map(k=>`\`${k}\`=?`).join(",")}, updated_at=NOW() WHERE id=? AND user_id=?`,
      [...keys.map(k => b[k]), req.params.id, req.user.sub]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.delete("/:id", requireAuth, async (req, res, next) => {
  try { await q("DELETE FROM user_addresses WHERE id=? AND user_id=?", [req.params.id, req.user.sub]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

export default r;
