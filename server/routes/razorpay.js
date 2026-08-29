import { Router } from "express";
import { rzp, verifySignature, loadKeysFromSettings } from "../lib/razorpay.js";
import { q } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
const r = Router();

r.use(async (_req, _res, next) => { await loadKeysFromSettings(); next(); });

r.get("/key", (_req, res) => res.json({ key_id: process.env.RAZORPAY_KEY_ID || "" }));

// Create order
r.post("/order", requireAuth, async (req, res, next) => {
  try {
    const amount = Math.round(Number(req.body.amount) * 100); // in paise
    if (!amount || amount < 100) return res.status(400).json({ error: "invalid amount" });
    const order = await rzp().orders.create({
      amount,
      currency: req.body.currency || "INR",
      receipt: req.body.receipt || `rcpt_${Date.now()}`,
      notes: req.body.notes || {},
    });
    res.json(order);
  } catch (e) { next(e); }
});

// Verify + mark order paid
r.post("/verify", requireAuth, async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;
    const ok = verifySignature({
      order_id: razorpay_order_id, payment_id: razorpay_payment_id, signature: razorpay_signature
    });
    if (!ok) return res.status(400).json({ error: "signature mismatch" });
    if (order_id) {
      await q(
        "UPDATE orders SET payment_status='paid', razorpay_order_id=?, razorpay_payment_id=?, updated_at=NOW() WHERE id=? AND user_id=?",
        [razorpay_order_id, razorpay_payment_id, order_id, req.user.sub]
      );
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
