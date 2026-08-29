import { Router } from "express";
import { q } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
const r = Router();

r.get("/me", requireAuth, async (req, res, next) => {
  try {
    const rows = await q(
      "SELECT id, full_name, phone, email, role, dob, address, created_at FROM profiles WHERE id=?",
      [req.user.sub]
    );
    res.json(rows[0] || null);
  } catch (e) { next(e); }
});

r.put("/me", requireAuth, async (req, res, next) => {
  try {
    const allowed = ["full_name", "email", "dob", "address"];
    const b = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const keys = Object.keys(b);
    if (!keys.length) return res.json({ ok: true });
    await q(`UPDATE profiles SET ${keys.map(k => `\`${k}\`=?`).join(",")}, updated_at=NOW() WHERE id=?`,
      [...keys.map(k => b[k]), req.user.sub]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Password change (mobile-first flow uses OTP endpoint for reset)
r.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const bcrypt = (await import("bcryptjs")).default;
    const { current_password, new_password } = req.body;
    const rows = await q("SELECT password_hash FROM profiles WHERE id=?", [req.user.sub]);
    if (!rows.length) return res.status(404).json({ error: "not found" });
    const ok = await bcrypt.compare(current_password || "", rows[0].password_hash || "");
    if (!ok) return res.status(400).json({ error: "current password wrong" });
    const hash = await bcrypt.hash(new_password, 10);
    await q("UPDATE profiles SET password_hash=?, updated_at=NOW() WHERE id=?", [hash, req.user.sub]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
