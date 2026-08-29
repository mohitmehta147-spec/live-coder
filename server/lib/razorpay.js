import crypto from "crypto";
import Razorpay from "razorpay";
import { q } from "../db.js";

// Fallback: pull keys from site_settings (admin panel) when env is blank.
export async function loadKeysFromSettings() {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) return;
  try {
    const rows = await q(
      "SELECT `key`, `value` FROM site_settings WHERE `key` IN ('razorpay_key_id','razorpay_key_secret')"
    );
    for (const r of rows) {
      if (r.key === "razorpay_key_id" && r.value) process.env.RAZORPAY_KEY_ID ||= r.value;
      if (r.key === "razorpay_key_secret" && r.value) process.env.RAZORPAY_KEY_SECRET ||= r.value;
    }
  } catch { /* settings table not ready yet */ }
}

let _rzp;
export function rzp() {
  if (_rzp) return _rzp;
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
    throw new Error("Razorpay keys not configured");
  _rzp = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return _rzp;
}

export function verifySignature({ order_id, payment_id, signature }) {
  const body = `${order_id}|${payment_id}`;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
