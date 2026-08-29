import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

r.post("/", async (req, res, next) => {
  try {
    const id = uuid();
    const b = req.body;
    await q(
      "INSERT INTO contact_inquiries (id, name, email, phone, subject, message, status) VALUES (?,?,?,?,?,?, 'new')",
      [id, b.name, b.email || null, b.phone || null, b.subject || null, b.message]
    );
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

r.get("/", requireAuth, requireAdmin, async (_req, res, next) => {
  try { res.json(await q("SELECT * FROM contact_inquiries ORDER BY created_at DESC LIMIT 500")); }
  catch (e) { next(e); }
});

r.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await q("UPDATE contact_inquiries SET status=?, updated_at=NOW() WHERE id=?", [req.body.status, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
