// CloudB2B / NimbusIT DLT SMS gateway
// Same gateway + params that the old cloud functions used, so DLT templates keep working.
import { q } from "../db.js";

const API_URL = process.env.SMS_API_URL || "http://sms1.cloudb2bsolutions.com/api/SmsApi/SendSingleApi";

// DLT template IDs — env first, then site_settings table (seeded from the live DB).
const ENV_TEMPLATE_KEYS = {
  otp: "SMS_TEMPLATE_ID_OTP",
  order: "SMS_TEMPLATE_ID_ORDER",
  order_placed: "SMS_TEMPLATE_ID_ORDER_PLACED",
  order_shipped: "SMS_TEMPLATE_ID_ORDER_SHIPPED",
  order_delivered: "SMS_TEMPLATE_ID_ORDER_DELIVERED",
  order_cancelled: "SMS_TEMPLATE_ID_ORDER_CANCELLED",
};

export async function getTemplateId(kind) {
  if (!kind) return "";
  if (/^\d{6,}$/.test(String(kind))) return String(kind); // already an ID
  const envVal = process.env[ENV_TEMPLATE_KEYS[kind] || ""] || "";
  if (envVal) return envVal;
  try {
    const rows = await q("SELECT value FROM site_settings WHERE `key`=? LIMIT 1", [`sms_template_id_${kind}`]);
    return rows[0]?.value || "";
  } catch {
    return "";
  }
}

// Credentials: .env first, then site_settings (admin panel → API & Login Credentials).
let _credCache = { at: 0, vals: {} };
async function creds() {
  const env = {
    UserID: process.env.SMS_USERNAME || "",
    Password: process.env.SMS_PASSWORD || "",
    SenderID: process.env.SMS_SENDER_ID || "VEDUPC",
    EntityID: process.env.SMS_ENTITY_ID || "",
  };
  if (env.UserID && env.Password && env.EntityID) return env;
  if (Date.now() - _credCache.at > 60_000) {
    try {
      const rows = await q(
        "SELECT `key`,`value` FROM site_settings WHERE `key` IN ('sms_username','sms_password','sms_sender_id','sms_entity_id','sms_api_url')"
      );
      _credCache = { at: Date.now(), vals: Object.fromEntries(rows.map(r => [r.key, r.value || ""])) };
    } catch { _credCache = { at: Date.now(), vals: {} }; }
  }
  const s = _credCache.vals;
  return {
    UserID: env.UserID || s.sms_username || "",
    Password: env.Password || s.sms_password || "",
    SenderID: process.env.SMS_SENDER_ID || s.sms_sender_id || "VEDUPC",
    EntityID: env.EntityID || s.sms_entity_id || "",
    apiUrl: s.sms_api_url || "",
  };
}

export async function sendSms(phone, message, kind = "otp") {
  const { UserID, Password, SenderID, EntityID, apiUrl } = await creds();

  const Phno = String(phone || "").replace(/\D/g, "").slice(-10);

  if (Phno.length !== 10) throw new Error("Invalid phone number");

  if (!UserID || !Password || !SenderID || !EntityID) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SMS not configured — set SMS_USERNAME, SMS_PASSWORD, SMS_ENTITY_ID (env) or sms_username/sms_password/sms_entity_id in Admin → Settings"
      );
    }
    console.log(`[sms:dev] to=${Phno} msg=${message}`);
    return { ok: true, dev: true };
  }

  const TemplateID = await getTemplateId(kind);
  if (!TemplateID) throw new Error(`SMS template not configured for "${kind}"`);

  const params = new URLSearchParams({
    UserID, Password, SenderID, Phno, Msg: String(message), EntityID, TemplateID,
  });

  const res = await fetch(`${apiUrl || API_URL}?${params.toString()}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`SMS ${res.status}: ${text}`);
  if (!text.includes('"Status":"OK"')) throw new Error(`SMS gateway rejected: ${text}`);
  return { ok: true, provider: text };
}

// Exact DLT-approved OTP text — do not reword.
export const otpMessage = (code) =>
  `Dear Customer, your OTP for VedicUpchar verification is ${code}. It is valid for 10 minutes. Please do not share it with anyone.`;
