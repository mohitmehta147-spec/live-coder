import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

r.get("/", async (req, res, next) => {
  try {
    const { section, all } = req.query;
    let sql = "SELECT * FROM banners";
    const params = [];
    const where = [];
    if (!all) where.push("is_active=1");
    if (section) { where.push("section=?"); params.push(section); }
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY sort_order ASC, created_at DESC";
    res.json(await q(sql, params));
  } catch (e) { next(e); }
});

r.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = req.body.id || uuid();
    const fields = { id, ...req.body };
    const keys = Object.keys(fields);
    const vals = keys.map(k => typeof fields[k] === "object" ? JSON.stringify(fields[k]) : fields[k]);
    await q(`INSERT INTO banners (${keys.map(k=>`\`${k}\``).join(",")}) VALUES (${keys.map(()=>"?").join(",")})`, vals);
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

r.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = req.body;
    const keys = Object.keys(b);
    const vals = keys.map(k => typeof b[k] === "object" ? JSON.stringify(b[k]) : b[k]);
    vals.push(req.params.id);
    await q(`UPDATE banners SET ${keys.map(k=>`\`${k}\`=?`).join(",")} WHERE id=?`, vals);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try { await q("DELETE FROM banners WHERE id=?", [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

export default r;
