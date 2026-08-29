import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

// Public list of approved reviews
r.get("/product/:product_id", async (req, res, next) => {
  try {
    res.json(await q(
      "SELECT * FROM product_reviews WHERE product_id=? AND status='approved' ORDER BY created_at DESC",
      [req.params.product_id]
    ));
  } catch (e) { next(e); }
});

// Submit review (public — anonymous allowed)
r.post("/", async (req, res, next) => {
  try {
    const id = uuid();
    const b = {
      id,
      product_id: req.body.product_id,
      user_id: req.body.user_id || null,
      user_name: req.body.user_name || req.body.name || "Anonymous",
      rating: Math.max(1, Math.min(5, Number(req.body.rating || 5))),
      title: req.body.title || null,
      comment: req.body.comment || "",
      images: JSON.stringify(req.body.images || []),
      is_verified_purchase: req.body.is_verified_purchase ? 1 : 0,
      status: "pending",
    };
    const keys = Object.keys(b);
    await q(
      `INSERT INTO product_reviews (${keys.map(k=>`\`${k}\``).join(",")}, created_at, updated_at)
       VALUES (${keys.map(()=>"?").join(",")}, NOW(), NOW())`,
      keys.map(k => b[k])
    );
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

// Admin: list with filters
r.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status, product_id } = req.query;
    let sql = "SELECT * FROM product_reviews WHERE 1=1";
    const params = [];
    if (status)     { sql += " AND status=?";     params.push(status); }
    if (product_id) { sql += " AND product_id=?"; params.push(product_id); }
    sql += " ORDER BY created_at DESC LIMIT 1000";
    res.json(await q(sql, params));
  } catch (e) { next(e); }
});

r.post("/admin", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = uuid();
    const b = {
      id,
      product_id: req.body.product_id,
      user_id: req.user.sub,
      user_name: req.body.user_name || "Admin",
      rating: Number(req.body.rating || 5),
      title: req.body.title || null,
      comment: req.body.comment || "",
      images: JSON.stringify(req.body.images || []),
      is_verified_purchase: req.body.is_verified_purchase ? 1 : 0,
      status: req.body.status || "approved",
    };
    const keys = Object.keys(b);
    await q(
      `INSERT INTO product_reviews (${keys.map(k=>`\`${k}\``).join(",")}, created_at, updated_at)
       VALUES (${keys.map(()=>"?").join(",")}, NOW(), NOW())`,
      keys.map(k => b[k])
    );
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

r.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = { ...req.body };
    if (Array.isArray(b.images)) b.images = JSON.stringify(b.images);
    const keys = Object.keys(b);
    if (!keys.length) return res.json({ ok: true });
    await q(
      `UPDATE product_reviews SET ${keys.map(k=>`\`${k}\`=?`).join(",")}, updated_at=NOW() WHERE id=?`,
      [...keys.map(k => b[k]), req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try { await q("DELETE FROM product_reviews WHERE id=?", [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

export default r;
