import { Router } from "express";
import { q } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
const r = Router();

r.use(requireAuth, requireAdmin);

r.get("/stats", async (_req, res, next) => {
  try {
    const [users]    = await q("SELECT COUNT(*) c FROM profiles");
    const [orders]   = await q("SELECT COUNT(*) c, COALESCE(SUM(total),0) s FROM orders");
    const [products] = await q("SELECT COUNT(*) c FROM products");
    const [pending]  = await q("SELECT COUNT(*) c FROM product_reviews WHERE status='pending'");
    const [cons]     = await q("SELECT COUNT(*) c FROM consultations WHERE status='pending'");
    res.json({
      users: users.c, products: products.c,
      orders: { count: orders.c, revenue: orders.s },
      pending_reviews: pending.c,
      pending_consultations: cons.c,
    });
  } catch (e) { next(e); }
});

r.get("/users", async (_req, res, next) => {
  try { res.json(await q("SELECT id, full_name, phone, email, created_at FROM profiles ORDER BY created_at DESC LIMIT 500")); }
  catch (e) { next(e); }
});

export default r;
