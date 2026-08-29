import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { sendSms, otpMessage } from "../lib/sms.js";
const r = Router();

const OTP_TTL_MIN = 10;
const genCode = () => String(Math.floor(100000 + Math.random() * 900000));

r.post("/send", async (req, res, next) => {
  try {
    const phone = String(req.body.phone || "").replace(/\D/g, "");
    if (phone.length < 10) return res.status(400).json({ error: "invalid phone" });
    const code = genCode();
    await q(
      "INSERT INTO otp_codes (id, phone, code, purpose, is_used, expires_at) VALUES (?,?,?,?,0, DATE_ADD(NOW(), INTERVAL ? MINUTE))",
      [uuid(), phone, code, req.body.purpose || "login", OTP_TTL_MIN]
    );
    try { await sendSms(phone, otpMessage(code), "otp"); } catch (e) { console.warn("[otp] sms failed", e.message); }
    res.json({ ok: true, ttl_minutes: OTP_TTL_MIN });
  } catch (e) { next(e); }
});

r.post("/verify", async (req, res, next) => {
  try {
    const phone = String(req.body.phone || "").replace(/\D/g, "");
    const code  = String(req.body.code || "");
    const rows = await q(
      "SELECT id FROM otp_codes WHERE phone=? AND code=? AND is_used=0 AND expires_at>=NOW() ORDER BY created_at DESC LIMIT 1",
      [phone, code]
    );
    if (!rows.length) return res.status(400).json({ error: "invalid or expired code" });
    await q("UPDATE otp_codes SET is_used=1 WHERE id=?", [rows[0].id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
