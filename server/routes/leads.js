import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { optionalAuth, requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

r.post("/", optionalAuth, async (req, res, next) => {
  try {
    const id = uuid();
    await q(
      `INSERT INTO lead_events (id, user_id, event_type, name, phone, email, city, note, status)
       VALUES (?,?,?,?,?,?,?,?, 'new')`,
      [
        id,
        req.user?.sub || null,
        req.body.event_type,
        req.body.name || null,
        req.body.phone || null,
        req.body.email || null,
        req.body.city || null,
        req.body.note || (req.body.metadata ? JSON.stringify(req.body.metadata) : null),
      ]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.get("/", requireAuth, requireAdmin, async (_req, res, next) => {
  try { res.json(await q("SELECT * FROM lead_events ORDER BY created_at DESC LIMIT 1000")); }
  catch (e) { next(e); }
});

export default r;
