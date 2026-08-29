import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

r.post("/subscribe", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email required" });
    await q(
      "INSERT INTO newsletter_subscribers (id, email, is_active, created_at) VALUES (?,?,1,NOW()) ON DUPLICATE KEY UPDATE is_active=1",
      [uuid(), email]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.post("/unsubscribe", async (req, res, next) => {
  try {
    await q("UPDATE newsletter_subscribers SET is_active=0 WHERE email=?", [String(req.body.email || "").toLowerCase()]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.get("/", requireAuth, requireAdmin, async (_req, res, next) => {
  try { res.json(await q("SELECT * FROM newsletter_subscribers ORDER BY created_at DESC")); }
  catch (e) { next(e); }
});

export default r;
