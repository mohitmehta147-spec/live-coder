#!/usr/bin/env node
/**
 * Creates a .env file in the project root if one is missing.
 * Useful for GitHub-based deploys where .env is gitignored.
 *
 *   npm run env
 *
 * Optional inline overrides:
 *   npm run env -- DB_USER=uXXXX_admin DB_PASSWORD=secret DB_NAME=uXXXX_db
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

const overrides = {};
for (const arg of process.argv.slice(2)) {
  const i = arg.indexOf("=");
  if (i > 0) overrides[arg.slice(0, i).trim()] = arg.slice(i + 1);
}

if (fs.existsSync(envPath) && !Object.keys(overrides).length) {
  console.log("✓ .env already exists — nothing to do.");
  console.log("  Edit it and set: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME");
  process.exit(0);
}

let content = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, "utf8")
  : fs.existsSync(examplePath)
    ? fs.readFileSync(examplePath, "utf8")
    : "";

if (!content) {
  console.error("✗ .env.example not found — cannot generate .env");
  process.exit(1);
}

// Values that are the same on every deploy — always kept filled in.
const AUTOFILL = {
  SMS_API_URL: "http://sms1.cloudb2bsolutions.com/api/SmsApi/SendSingleApi",
  SMS_SENDER_ID: "VEDUPC",
  SMS_USERNAME: "vedic",
  SMS_PASSWORD: "123456789",
  SMS_ENTITY_ID: "1701161552514224289",
  SMS_TEMPLATE_ID_OTP: "1707177632353858035",
  SMS_TEMPLATE_ID_ORDER: "1707177632378042773",
  SMS_TEMPLATE_ID_ORDER_PLACED: "1707177632407981788",
  SMS_TEMPLATE_ID_ORDER_SHIPPED: "1707177632439364672",
  SMS_TEMPLATE_ID_ORDER_DELIVERED: "1707177632415978493",
  SMS_TEMPLATE_ID_ORDER_CANCELLED: "1707177632423145640",
  RAZORPAY_KEY_ID: "rzp_live_VBLRSoObcWFgms",
  RAZORPAY_KEY_SECRET: "yOrRRG9OyuJWJA7f4A8xW3w2",
  SMTP_HOST: "smtp.hostinger.com",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  UPLOAD_DIR: "./uploads",
  PORT: "3000",
};

// Always give a fresh strong JWT secret on first creation
if (!fs.existsSync(envPath)) {
  overrides.JWT_SECRET ||= crypto.randomBytes(48).toString("hex");
  overrides.NODE_ENV ||= "production";
  overrides.DB_HOST ||= "127.0.0.1";
}

const setKey = (text, key, value) => {
  const re = new RegExp(`^\\s*#?\\s*${key}=.*$`, "m");
  const line = `${key}=${value}`;
  return re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
};

// Autofill only where the key is empty/placeholder and not explicitly overridden
for (const [k, v] of Object.entries(AUTOFILL)) {
  if (k in overrides) continue;
  const m = content.match(new RegExp(`^\\s*#?\\s*${k}=(.*)$`, "m"));
  const cur = (m?.[1] || "").trim();
  if (!cur || /^(rzp_test_xxx|x{4,}|change_me)$/i.test(cur)) content = setKey(content, k, v);
}

for (const [k, v] of Object.entries(overrides)) content = setKey(content, k, v);

fs.writeFileSync(envPath, content, { mode: 0o600 });
console.log(`✓ .env created at ${envPath}`);

const missing = ["DB_USER", "DB_PASSWORD", "DB_NAME"].filter((k) => {
  const m = content.match(new RegExp(`^${k}=(.*)$`, "m"));
  const v = (m?.[1] || "").trim();
  return !v || /change_me|YourDbPassword|^u000000000_/.test(v);
});

if (missing.length) {
  console.log("\n⚠ Ab .env kholkar ye values bharo (Hostinger hPanel → MySQL Databases):");
  for (const k of missing) console.log(`   ${k}=`);
  console.log("\n   (SMS ke liye sirf SMS_USERNAME + SMS_PASSWORD + SMS_ENTITY_ID bharna hai — baaki sab autofill hai)");
  console.log("\n   Fill karne ke baad:  npm run setup && npm run build && npm start");
} else {
  console.log("\nNext:  npm run setup && npm run build && npm start");
}
