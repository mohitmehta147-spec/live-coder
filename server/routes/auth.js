import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { sendSms } from "../lib/sms.js";

const r = Router();

// Normalise the many phone shapes the frontend sends: "+91 98765 43210" -> "9876543210"
const digits10 = (v) => String(v || "").replace(/\D/g, "").slice(-10);

// The frontend shim wraps Supabase's phone-magic-email convention "<phone>@phone.local"
// so both "email" and "phone" fields must be treated as the same login key.
function extractPhone(body = {}) {
  const raw = body.phone || body.mobile || body.email || "";
  const s = String(raw);
  if (/^\d+@phone\.local$/i.test(s)) return digits10(s.split("@")[0]);
  return digits10(s);
}

// Mobile-first signup
r.post("/signup", async (req, res, next) => {
  try {
    const full_name = req.body?.full_name || req.body?.options?.data?.full_name || null;
    const phone = extractPhone(req.body);
    const password = req.body?.password;
    const email = req.body?.email && !/@phone\.local$/i.test(req.body.email) ? req.body.email : null;
    if (!full_name || !phone || !password)
      return res.status(400).json({ error: "name, mobile, password required" });
    const existing = await q("SELECT id FROM profiles WHERE phone=? LIMIT 1", [phone]);
    if (existing.length) return res.status(409).json({ error: "Mobile already registered" });
    const id = uuid();
    const hash = await bcrypt.hash(password, 10);
    await q(
      "INSERT INTO profiles (id, user_id, full_name, phone, email, password_hash, role, created_at, updated_at) VALUES (?,?,?,?,?,?, 'user', NOW(), NOW())",
      [id, id, full_name, phone, email, hash]
    );
    const user = { id, full_name, phone, email, role: "user" };
    res.json({ token: signToken(user), user });
  } catch (e) { next(e); }
});

// Login: accepts either mobile or the phone-magic-email form
r.post("/login", async (req, res, next) => {
  try {
    const phone = extractPhone(req.body);
    const password = req.body?.password;
    if (!phone) return res.status(400).json({ error: "mobile required" });
    const rows = await q(
      "SELECT id, full_name, phone, email, password_hash, role FROM profiles WHERE phone=? LIMIT 1",
      [phone]
    );
    if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password || "", rows[0].password_hash || "");
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const user = { id: rows[0].id, full_name: rows[0].full_name, phone: rows[0].phone, email: rows[0].email, role: rows[0].role };
    res.json({ token: signToken(user), user });
  } catch (e) { next(e); }
});

// Update the caller's profile / password. Mirrors supabase.auth.updateUser.
r.post("/update", requireAuth, async (req, res, next) => {
  try {
    const uid = req.user.sub;
    const { password, email, data } = req.body || {};
    const sets = [];
    const vals = [];
    if (email) { sets.push("email=?"); vals.push(email); }
    if (data?.full_name) { sets.push("full_name=?"); vals.push(data.full_name); }
    if (password) { sets.push("password_hash=?"); vals.push(await bcrypt.hash(password, 10)); }
    if (!sets.length) return res.json({ user: null });
    sets.push("updated_at=NOW()"); vals.push(uid);
    await q(`UPDATE profiles SET ${sets.join(",")} WHERE id=?`, vals);
    const rows = await q("SELECT id, full_name, phone, email, role FROM profiles WHERE id=?", [uid]);
    res.json({ user: rows[0] || null });
  } catch (e) { next(e); }
});


// Reset password via OTP (verify handled by /api/otp/verify; then call this)
r.post("/reset-password", async (req, res, next) => {
  try {
    const { mobile, code, new_password } = req.body;
    const otp = await q(
      "SELECT id FROM otp_codes WHERE phone=? AND code=? AND is_used=1 AND expires_at>=DATE_SUB(NOW(), INTERVAL 15 MINUTE) ORDER BY created_at DESC LIMIT 1",
      [mobile, code]
    );
    if (!otp.length) return res.status(400).json({ error: "verify OTP first" });
    const hash = await bcrypt.hash(new_password, 10);
    const upd = await q("UPDATE profiles SET password_hash=?, updated_at=NOW() WHERE phone=?", [hash, mobile]);
    if (!upd.affectedRows) return res.status(404).json({ error: "user not found" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.get("/me", requireAuth, async (req, res, next) => {
  try {
    const rows = await q(
      "SELECT id, full_name, phone, email, role, created_at FROM profiles WHERE id=?",
      [req.user.sub]
    );
    res.json(rows[0] || null);
  } catch (e) { next(e); }
});

export default r;
