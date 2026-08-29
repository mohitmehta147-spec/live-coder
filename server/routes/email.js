import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

// Queue an app email
r.post("/queue", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = uuid();
    await q(
      `INSERT INTO email_send_log (id, message_id, template_name, recipient_email, status, metadata)
       VALUES (?,?,?,?, 'queued', ?)`,
      [id, uuid(), req.body.template || "generic", req.body.to, JSON.stringify(req.body.data || {})]
    );
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

r.get("/log", requireAuth, requireAdmin, async (_req, res, next) => {
  try { res.json(await q("SELECT * FROM email_send_log ORDER BY created_at DESC LIMIT 200")); }
  catch (e) { next(e); }
});

r.get("/unsubscribe/:token", async (req, res, next) => {
  try {
    const rows = await q("SELECT email FROM email_unsubscribe_tokens WHERE token=? LIMIT 1", [req.params.token]);
    if (!rows.length) return res.status(404).json({ error: "invalid token" });
    await q(
      "INSERT INTO suppressed_emails (id, email, reason, created_at) VALUES (?,?, 'unsubscribe', NOW())",
      [uuid(), rows[0].email]
    );
    await q("UPDATE email_unsubscribe_tokens SET used_at=NOW() WHERE token=?", [req.params.token]);
    res.json({ ok: true, email: rows[0].email });
  } catch (e) { next(e); }
});

export default r;
