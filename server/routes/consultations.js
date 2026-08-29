import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { optionalAuth, requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

r.post("/", optionalAuth, async (req, res, next) => {
  try {
    const id = uuid();
    const b = req.body;
    await q(
      `INSERT INTO consultations
       (id, patient_name, mobile, city, disease, gender, consultation_type, consultation_date, consultation_time, status, notes, age, file_urls, user_id, created_at)
       VALUES (?,?,?,?,?,?,?,?,?, 'pending', ?, ?, ?, ?, NOW())`,
      [
        id,
        b.patient_name || b.name,
        b.mobile || b.phone,
        b.city || null,
        b.disease || b.health_issue || null,
        b.gender || null,
        b.consultation_type || "online",
        b.consultation_date || null,
        b.consultation_time || null,
        b.notes || null,
        b.age || null,
        JSON.stringify(b.file_urls || b.files || []),
        req.user?.sub || null,
      ]
    );
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

r.get("/mine", requireAuth, async (req, res, next) => {
  try { res.json(await q("SELECT * FROM consultations WHERE user_id=? ORDER BY created_at DESC", [req.user.sub])); }
  catch (e) { next(e); }
});

r.get("/", requireAuth, requireAdmin, async (_req, res, next) => {
  try { res.json(await q("SELECT * FROM consultations ORDER BY created_at DESC LIMIT 500")); }
  catch (e) { next(e); }
});

r.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = req.body; const keys = Object.keys(b);
    await q(`UPDATE consultations SET ${keys.map(k=>`\`${k}\`=?`).join(",")} WHERE id=?`,
      [...keys.map(k => b[k]), req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
