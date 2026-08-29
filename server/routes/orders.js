import { Router } from "express";
import { v4 as uuid } from "uuid";
import { q, pool } from "../db.js";
import { requireAuth, requireAdmin, optionalAuth } from "../middleware/auth.js";
import { sendOrderEmails, sendOrderStatusEmail } from "../lib/mailer.js";
const r = Router();

async function nextOrderNumber() {
  const today = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }).replace(/\//g, "");
  await q(
    "INSERT INTO order_sequence (date_key, counter) VALUES ('global', 1) ON DUPLICATE KEY UPDATE counter=counter+1"
  );
  const [row] = await q("SELECT counter FROM order_sequence WHERE date_key='global'");
  return `VU/${today}/${String(row.counter).padStart(4, "0")}`;
}

// Create order (guest checkout allowed)
r.post("/", optionalAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const id = uuid();
    const order_number = await nextOrderNumber();
    const b = req.body;
    await conn.execute(
      `INSERT INTO orders
       (id, order_number, user_id, customer_name, customer_phone, customer_email,
        address, city, state, pincode, total, subtotal, discount, shipping,
        status, payment_status, payment_method, shipping_address, items, notes, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [
        id, order_number, req.user?.sub || b.user_id || null,
        b.customer_name ?? null, b.customer_phone ?? null, b.customer_email ?? null,
        b.address ?? (typeof b.shipping_address === "string" ? b.shipping_address : null),
        b.city ?? null, b.state ?? null, b.pincode ?? null,
        Number(b.total || 0), Number(b.subtotal || b.total || 0), Number(b.discount || 0), Number(b.shipping || 0),
        b.status || "pending", b.payment_status || "pending", b.payment_method || "cod",
        typeof b.shipping_address === "string" ? b.shipping_address : JSON.stringify(b.shipping_address || {}),
        JSON.stringify(b.items || []), b.notes ?? null,
      ]
    );
    for (const it of (b.items || [])) {
      await conn.execute(
        `INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity)
         VALUES (?,?,?,?,?,?)`,
        [uuid(), id, it.product_id || it.id, it.name || it.product_name, it.price, it.quantity]
      );
      if (it.product_id || it.id) {
        await conn.execute(
          "UPDATE products SET stock = GREATEST(0, IFNULL(stock,0) - ?) WHERE id=?",
          [it.quantity, it.product_id || it.id]
        );
      }
    }
    await conn.commit();
    // Confirmation to customer + notification to admin (best effort)
    try {
      const [row] = await q("SELECT * FROM orders WHERE id=? LIMIT 1", [id]);
      if (row) sendOrderEmails({ ...row, items: b.items || [] }).catch(() => {});
    } catch { /* ignore */ }
    res.json({ ok: true, id, order_number });
  } catch (e) {
    await conn.rollback(); next(e);
  } finally { conn.release(); }
});

// Own orders
r.get("/mine", requireAuth, async (req, res, next) => {
  try { res.json(await q("SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC", [req.user.sub])); }
  catch (e) { next(e); }
});

r.get("/mine/:id", requireAuth, async (req, res, next) => {
  try {
    const rows = await q("SELECT * FROM orders WHERE id=? AND user_id=? LIMIT 1", [req.params.id, req.user.sub]);
    if (!rows.length) return res.status(404).json({ error: "not found" });
    const items = await q("SELECT * FROM order_items WHERE order_id=?", [req.params.id]);
    res.json({ ...rows[0], items });
  } catch (e) { next(e); }
});

// Track by number (public)
r.get("/track/:number", async (req, res, next) => {
  try {
    const rows = await q(
      "SELECT id, order_number, status, payment_status, tracking_id, tracking_url, estimated_delivery, total, created_at FROM orders WHERE order_number=? LIMIT 1",
      [req.params.number]
    );
    res.json(rows[0] || null);
  } catch (e) { next(e); }
});

// Admin: all orders + full CRUD
r.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status, search, limit = 500 } = req.query;
    let sql = "SELECT * FROM orders WHERE 1=1";
    const params = [];
    if (status) { sql += " AND status=?"; params.push(status); }
    if (search) { sql += " AND (order_number LIKE ? OR customer_phone LIKE ? OR customer_name LIKE ?)";
                  params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    sql += " ORDER BY created_at DESC LIMIT ?"; params.push(Number(limit));
    res.json(await q(sql, params));
  } catch (e) { next(e); }
});

r.get("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const rows = await q("SELECT * FROM orders WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "not found" });
    const items = await q("SELECT * FROM order_items WHERE order_id=?", [req.params.id]);
    res.json({ ...rows[0], items });
  } catch (e) { next(e); }
});

r.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = { ...req.body };
    if (b.shipping_address && typeof b.shipping_address === "object") b.shipping_address = JSON.stringify(b.shipping_address);
    if (b.items && typeof b.items === "object") b.items = JSON.stringify(b.items);
    const keys = Object.keys(b);
    if (!keys.length) return res.json({ ok: true });
    await q(`UPDATE orders SET ${keys.map(k=>`\`${k}\`=?`).join(",")}, updated_at=NOW() WHERE id=?`,
      [...keys.map(k => b[k]), req.params.id]);
    if (b.status) {
      try {
        const [row] = await q("SELECT * FROM orders WHERE id=? LIMIT 1", [req.params.id]);
        if (row) sendOrderStatusEmail(row, String(b.status)).catch(() => {});
      } catch { /* ignore */ }
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await q("DELETE FROM order_items WHERE order_id=?", [req.params.id]);
    await q("DELETE FROM orders WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
