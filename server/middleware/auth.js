import jwt from "jsonwebtoken";
import { q } from "../db.js";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, phone: user.phone, name: user.full_name, role: user.role || "user" },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

export function requireAuth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: "no token" });
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: "invalid token" }); }
}

export function optionalAuth(req, _res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (token) req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch { /* ignore */ }
  next();
}

export async function requireAdmin(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: "auth required" });
    if (req.user.role === "admin") return next();
    // Fall back to db check (roles may have changed since token issue)
    const pr = await q("SELECT role FROM profiles WHERE id=? LIMIT 1", [req.user.sub]);
    if (pr[0]?.role === "admin") { req.user.role = "admin"; return next(); }
    const rr = await q("SELECT 1 FROM user_roles WHERE user_id=? AND role='admin' LIMIT 1", [req.user.sub]);
    if (rr.length) { req.user.role = "admin"; return next(); }
    res.status(403).json({ error: "admin only" });
  } catch (e) { next(e); }
}
