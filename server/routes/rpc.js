// RPC endpoints exposed to the frontend shim. Each name here mirrors a
// Postgres function that the old Supabase project shipped.
import { Router } from "express";
import { q } from "../db.js";

const r = Router();

// has_role({ _user_id, _role }) — the frontend uses this to gate the admin area.
r.post("/has_role", async (req, res, next) => {
  try {
    const uid = req.body?._user_id;
    const role = req.body?._role || "admin";
    if (!uid) return res.json(false);
    const rows = await q(
      `SELECT 1 FROM user_roles WHERE user_id=? AND role=? LIMIT 1`, [uid, role]
    );
    if (rows.length) return res.json(true);
    // Fall back to profiles.role column
    const p = await q(`SELECT role FROM profiles WHERE user_id=? LIMIT 1`, [uid]);
    res.json(!!(p[0] && p[0].role === role));
  } catch (e) { next(e); }
});

// current_user_phone_digits() — returns the last 10 digits of the caller's phone.
r.post("/current_user_phone_digits", (req, res) => {
  const p = String(req.user?.phone || "").replace(/\D/g, "").slice(-10);
  res.json(p);
});

export default r;
