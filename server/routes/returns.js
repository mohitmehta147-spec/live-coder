import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

r.get("/mine", requireAuth, async (req, res, next) => {
  try { res.json(await q("SELECT * FROM returns WHERE user_id=? ORDER BY created_at DESC", [req.user.sub])); }
  catch (e) { next(e); }
});

r.post("/", requireAuth, async (req, res, next) => {
  try {
    const id = uuid();
    const b = { id, user_id: req.user.sub, status: "pending", ...req.body };
    const keys = Object.keys(b);
    const vals = keys.map(k => typeof b[k] === "object" ? JSON.stringify(b[k]) : b[k]);
    await q(`INSERT INTO returns (${keys.map(k=>`\`${k}\``).join(",")}) VALUES (${keys.map(()=>"?").join(",")})`, vals);
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

r.get("/", requireAuth, requireAdmin, async (_req, res, next) => {
  try { res.json(await q("SELECT * FROM returns ORDER BY created_at DESC LIMIT 500")); }
  catch (e) { next(e); }
});

r.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = req.body; const keys = Object.keys(b);
    await q(`UPDATE returns SET ${keys.map(k=>`\`${k}\`=?`).join(",")}, updated_at=NOW() WHERE id=?`,
      [...keys.map(k => b[k]), req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
