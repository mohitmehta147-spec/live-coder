// Named function endpoints. The frontend shim rewrites
// supabase.functions.invoke(name, { body }) to POST /api/functions/:name.
// Each function is a thin wrapper over real backend logic (SMS, mail, RZP...).

import { Router } from "express";
import { q, pool } from "../db.js";
import { sendSms, otpMessage } from "../lib/sms.js";
import { sendMail, sendOrderEmails, sendAdminNotification, ADMIN_EMAILS, layout, table } from "../lib/mailer.js";
import { rzp, loadKeysFromSettings } from "../lib/razorpay.js";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { signToken } from "../middleware/auth.js";

const r = Router();

const norm = (x) => String(x || "").replace(/\D/g, "").slice(-10);

// ---------- OTP ---------------------------------------------------------------
// NOTE: expires_at ko hamesha MySQL ke NOW() se banate hain — Node aur MySQL ka
// timezone alag ho to JS Date bhejne par OTP turant "expired" ho jata tha.
r.post("/send-otp", async (req, res, next) => {
  try {
    const phone = norm(req.body?.mobile || req.body?.phone);
    if (phone.length !== 10) return res.status(400).json({ error: "invalid mobile" });
    const purpose = req.body?.purpose || "login";

    const prof = await q("SELECT id, full_name, email FROM profiles WHERE phone=? LIMIT 1", [phone]);
    const userExists = prof.length > 0;
    // Only ask for name/email when we don't already have them on file.
    const p = prof[0];
    const nameOk = !!(p?.full_name && p.full_name.trim() && p.full_name.trim().toLowerCase() !== "user");
    const emailOk = !!(p?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) && !/@phone\.local$/i.test(p.email));
    const needsProfile = !userExists || !nameOk || !emailOk;
    if (purpose === "forgot_password" && !userExists)
      return res.status(404).json({ error: "No account found with this mobile number" });

    // Reuse an active OTP so resend doesn't invalidate the code already sent
    const active = await q(
      `SELECT code FROM otp_codes WHERE phone=? AND purpose=? AND is_used=0
       AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`, [phone, purpose]
    );
    let code = active[0]?.code;
    if (!code) {
      code = String(Math.floor(100000 + Math.random() * 900000));
      await q(
        `INSERT INTO otp_codes (id, phone, code, purpose, expires_at, is_used, created_at)
         VALUES (?,?,?,?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0, NOW())`,
        [uuid(), phone, code, purpose]
      );
    }
    try { await sendSms(phone, otpMessage(code), "otp"); }
    catch (e) { console.warn("[otp] sms failed:", e.message); }
    res.json({ success: true, userExists, needsProfile });
  } catch (e) { next(e); }
});

r.post("/verify-otp", async (req, res, next) => {
  try {
    const { default: bcrypt } = await import("bcryptjs");
    const phone   = norm(req.body?.mobile || req.body?.phone);
    const code    = String(req.body?.otp || req.body?.code || "");
    const purpose = req.body?.purpose || "login";
    const rows = await q(
      `SELECT * FROM otp_codes WHERE phone=? AND code=? AND purpose=? AND is_used=0
       AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`, [phone, code, purpose]
    );
    if (!rows.length)
      return res.status(400).json({ success: false, error: "Invalid or expired OTP" });
    await q(`UPDATE otp_codes SET is_used=1 WHERE id=?`, [rows[0].id]);

    if (purpose === "forgot_password" || req.body?.verify_only) {
      return res.json({ success: true, verified: true, reset_token: `${phone}.${rows[0].id}` });
    }

    // Login: find or create the profile, then hand back a JWT session
    let user = (await q(
      "SELECT id, full_name, phone, email, role FROM profiles WHERE phone=? LIMIT 1", [phone]
    ))[0];

    if (!user) {
      const id = uuid();
      const full_name = String(req.body?.full_name || "User").trim() || "User";
      const email = req.body?.email || null;
      const hash = await bcrypt.hash(`otp_${phone}_${Date.now()}`, 10);
      await q(
        `INSERT INTO profiles (id, user_id, full_name, phone, email, password_hash, role, created_at, updated_at)
         VALUES (?,?,?,?,?,?, 'user', NOW(), NOW())`,
        [id, id, full_name, phone, email, hash]
      );
      user = { id, full_name, phone, email, role: "user" };
    } else {
      // Fill in details we didn't have yet (name / email) without re-asking later
      const nm = String(req.body?.full_name || "").trim();
      const em = String(req.body?.email || "").trim();
      const sets = [], vals = [];
      if (nm && (!user.full_name || user.full_name.trim().toLowerCase() === "user")) { sets.push("full_name=?"); vals.push(nm); user.full_name = nm; }
      if (em && (!user.email || /@phone\.local$/i.test(user.email))) { sets.push("email=?"); vals.push(em); user.email = em; }
      if (sets.length) {
        vals.push(user.id);
        await q(`UPDATE profiles SET ${sets.join(",")}, updated_at=NOW() WHERE id=?`, vals);
      }
    }

    const token = signToken(user);
    res.json({
      success: true, verified: true, user,
      access_token: token, refresh_token: token,
    });
  } catch (e) { next(e); }
});

// ---------- Reset password ----------------------------------------------------
r.post("/reset-password", async (req, res, next) => {
  try {
    const phone = norm(req.body?.mobile || req.body?.phone);
    const newPassword = String(req.body?.new_password || req.body?.newPassword || "");
    const resetToken = String(req.body?.reset_token || "");
    if (phone.length !== 10 || newPassword.length < 6)
      return res.status(400).json({ error: "invalid input" });
    if (!resetToken.startsWith(`${phone}.`))
      return res.status(401).json({ error: "verify OTP first" });
    const { default: bcrypt } = await import("bcryptjs");
    const hash = await bcrypt.hash(newPassword, 10);
    const upd = await q(
      `UPDATE profiles SET password_hash=?, updated_at=NOW() WHERE phone=?`, [hash, phone]
    );
    if (!upd.affectedRows) return res.status(404).json({ error: "user not found" });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ---------- Razorpay ----------------------------------------------------------
r.post("/create-razorpay-order", async (req, res, next) => {
  try {
    const amount = Math.round(Number(req.body?.amount || 0) * 100);
    if (!amount) return res.status(400).json({ error: "amount required" });
    await loadKeysFromSettings();
    const receipt = String(req.body?.receipt || `rcpt_${Date.now()}`);
    const order = await rzp().orders.create({
      amount, currency: req.body?.currency || "INR",
      receipt: receipt.slice(0, 40),
      notes: req.body?.notes || {},
    });
    // Remember the gateway order id on our own row so "Verify Payment" /
    // reconcile can always find the transaction later.
    try {
      await q(`UPDATE orders SET razorpay_order_id=?, payment_method='razorpay', updated_at=NOW() WHERE id=?`,
        [order.id, receipt]);
    } catch (e) { console.warn("[rzp] could not tag order:", e.message); }
    res.json({ order_id: order.id, amount: order.amount, currency: order.currency,
               key_id: process.env.RAZORPAY_KEY_ID });
  } catch (e) { next(e); }
});

r.post("/verify-razorpay-payment", async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body || {};
    await loadKeysFromSettings();
    const secret = process.env.RAZORPAY_KEY_SECRET || "";
    if (!secret) return res.status(500).json({ verified: false, error: "Razorpay secret not configured" });
    const expected = crypto.createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (expected !== razorpay_signature)
      return res.status(400).json({ verified: false, error: "signature mismatch" });

    if (order_id) {
      await q(
        `UPDATE orders SET payment_status='paid', status=IF(status='pending','pending',status),
                payment_method='razorpay', payment_id=?, razorpay_payment_id=?,
                razorpay_order_id=?, razorpay_signature=?, paid_at=NOW(), updated_at=NOW()
         WHERE id=?`,
        [razorpay_payment_id, razorpay_payment_id, razorpay_order_id, razorpay_signature, order_id]
      );
    }
    res.json({ verified: true, payment_id: razorpay_payment_id });
  } catch (e) { next(e); }
});

r.post("/reconcile-razorpay-order", async (req, res, next) => {
  try {
    const orderId = req.body?.order_id;
    if (!orderId) return res.status(400).json({ error: "order_id required" });
    await loadKeysFromSettings();

    const [own] = await q(`SELECT * FROM orders WHERE id=? LIMIT 1`, [orderId]);
    if (!own) return res.status(404).json({ error: "order not found" });

    // 1. Known gateway order id, else look it up by receipt (= our order id)
    let rzpOrderIds = own.razorpay_order_id ? [own.razorpay_order_id] : [];
    if (!rzpOrderIds.length) {
      const list = await rzp().orders.all({ count: 100 });
      rzpOrderIds = (list.items || [])
        .filter(o => String(o.receipt || "") === String(orderId))
        .map(o => o.id);
    }
    if (!rzpOrderIds.length)
      return res.status(404).json({ error: "No Razorpay transaction found for this order" });

    for (const rid of rzpOrderIds) {
      const payments = await rzp().orders.fetchPayments(rid);
      const paid = (payments.items || []).find(p => p.status === "captured" || p.status === "authorized");
      if (paid) {
        await q(
          `UPDATE orders SET payment_status='paid', payment_method='razorpay', payment_id=?,
                  razorpay_payment_id=?, razorpay_order_id=?, paid_at=NOW(), updated_at=NOW() WHERE id=?`,
          [paid.id, paid.id, rid, orderId]
        );
        return res.json({ reconciled: true, payment_id: paid.id, razorpay_order_id: rid, status: paid.status });
      }
    }
    res.json({ reconciled: false, error: "No captured payment found yet" });
  } catch (e) { next(e); }
});

// ---------- Emails / SMS notifications ----------------------------------------
r.post("/send-order-email", async (req, res, next) => {
  try {
    const { to, subject, html, orderId } = req.body || {};
    if (to && subject && html) { await sendMail({ to, subject, html }); return res.json({ sent: true }); }
    if (orderId) {
      const [row] = await q("SELECT * FROM orders WHERE id=? LIMIT 1", [orderId]);
      if (row) {
        const items = await q("SELECT * FROM order_items WHERE order_id=?", [orderId]);
        await sendOrderEmails({
          ...row,
          customer_email: row.customer_email || req.body?.customerEmail || null,
          items: items.length ? items : (req.body?.items || []),
        });
      }
    }
    res.json({ sent: true });
  } catch (e) { next(e); }
});

r.post("/send-order-sms", async (req, res, next) => {
  try {
    const phone = norm(req.body?.phone || req.body?.customerPhone);
    if (phone && req.body?.message)
      await sendSms(phone, String(req.body.message), req.body?.template_key || req.body?.template_id || "order");
    res.json({ sent: true });
  } catch (e) { next(e); }
});

// Admin notifications for every form/lead + any generic app email.
r.post("/send-transactional-email", async (req, res, next) => {
  try {
    const { recipientEmail, templateName, templateData, subjectLine } = req.body || {};
    const d = templateData || {};
    if (templateName === "admin-notification" || d.formType) {
      await sendAdminNotification({
        formType: d.formType || templateName,
        subjectLine: subjectLine || d.subjectLine,
        fields: d.fields || {},
        siteName: d.siteName,
      });
      return res.json({ sent: true });
    }
    if (!recipientEmail) return res.status(400).json({ error: "recipientEmail required" });
    await sendMail({
      to: recipientEmail,
      subject: subjectLine || templateName || "Notification",
      html: layout(subjectLine || templateName || "Notification", table(Object.entries(d.fields || d))),
    });
    res.json({ sent: true });
  } catch (e) { next(e); }
});

// ---------- Unsubscribe -------------------------------------------------------
r.post("/handle-email-unsubscribe", async (req, res, next) => {
  try {
    const token = String(req.body?.token || "");
    if (!token) return res.status(400).json({ error: "token required" });
    const rows = await q(`SELECT email FROM email_unsubscribe_tokens WHERE token=? LIMIT 1`, [token]);
    if (!rows.length) return res.status(404).json({ error: "invalid token" });
    await q(`INSERT IGNORE INTO suppressed_emails (id, email, reason, created_at)
             VALUES (?,?,?,NOW())`, [uuid(), rows[0].email, "user_unsubscribe"]);
    res.json({ success: true, email: rows[0].email });
  } catch (e) { next(e); }
});

// ---------- WooCommerce imports (no-op in standalone) -------------------------
const wcNoop = (_req, res) => res.status(501).json({
  error: "WooCommerce import is disabled in the standalone build. Run the importer scripts directly against the database.",
});
r.post("/wc-import-blogs",    wcNoop);
r.post("/wc-import-orders",   wcNoop);
r.post("/wc-import-products", wcNoop);

// ---------- Health chat (AI passthrough disabled) -----------------------------
r.post("/health-chat", (_req, res) =>
  res.status(501).json({ error: "AI chat disabled in standalone build" }));

export default r;
