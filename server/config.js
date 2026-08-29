// Single source of truth for domain-based config.
// Single-app deploy: frontend + API + uploads all live on ONE origin (SITE_DOMAIN).
// Sirf SITE_DOMAIN badalne se CORS_ORIGIN, PUBLIC_URL, WC_SITE_URL — sab update ho jate hain.
import "dotenv/config";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SITE_DOMAIN = (process.env.SITE_DOMAIN || "vedicupchar.com")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

const SITE_URL = `https://${SITE_DOMAIN}`;
const WWW_URL  = SITE_DOMAIN.startsWith("www.") ? SITE_URL : `https://www.${SITE_DOMAIN}`;
// Same-origin API in the unified app (no api. subdomain needed).
const API_URL  = SITE_URL;

const CORS_ORIGIN = (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.trim())
  || `${SITE_URL},${WWW_URL},http://localhost:8080`;

const PUBLIC_URL  = (process.env.PUBLIC_URL && process.env.PUBLIC_URL.trim())
  || API_URL;

const WC_SITE_URL = (process.env.WC_SITE_URL && process.env.WC_SITE_URL.trim())
  || SITE_URL;

// API base the browser bundle talks to. Empty = same origin (recommended).
const API_BASE_URL = (process.env.VITE_API_URL && process.env.VITE_API_URL.trim()) || "";

// Hostinger's Git deploy can run inside a different working directory/container
// than File Manager. Prefer the first non-empty media directory we can actually
// see instead of blindly creating an empty UPLOAD_DIR that hides existing files.
const configuredUploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(ROOT, "..", "uploads"));
const homeMatch = configuredUploadDir.match(/^(\/home\/[^/]+)/);
const accountHome = homeMatch?.[1] || "";
const uploadCandidates = [
  configuredUploadDir,
  path.join(ROOT, "uploads"),
  path.resolve(ROOT, "..", "uploads"),
  path.resolve(process.cwd(), "uploads"),
  path.resolve(process.cwd(), "..", "uploads"),
  accountHome && path.join(accountHome, "uploads"),
  accountHome && path.join(accountHome, "domains", SITE_DOMAIN, "uploads"),
  accountHome && path.join(accountHome, "domains", SITE_DOMAIN, "public_html", "uploads"),
].filter(Boolean);

function containsMedia(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) return true;
      if (entry.isDirectory()) {
        try {
          if (fs.readdirSync(path.join(dir, entry.name)).length > 0) return true;
        } catch { /* inaccessible child */ }
      }
    }
  } catch { /* missing/inaccessible candidate */ }
  return false;
}

const uniqueUploadCandidates = [...new Set(uploadCandidates)];
const UPLOAD_DIR = uniqueUploadCandidates.find(containsMedia) || configuredUploadDir;
const MEDIA_DIRS = [
  UPLOAD_DIR,
  ...uniqueUploadCandidates.filter((dir) => dir !== UPLOAD_DIR && containsMedia(dir)),
];

// Re-export into process.env so legacy code reading process.env.* gets derived values.
process.env.CORS_ORIGIN = CORS_ORIGIN;
process.env.PUBLIC_URL  = PUBLIC_URL;
process.env.WC_SITE_URL = WC_SITE_URL;
process.env.SITE_URL    = SITE_URL;
process.env.UPLOAD_DIR  = UPLOAD_DIR;

// ---- Startup validation: warn loudly, but NEVER exit ----
// Exiting made Hostinger serve a 503 with no logs. Better: boot, serve the
// frontend, and report the problem on /api/health.
const REQUIRED = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET"];
const missing = REQUIRED.filter((k) => !process.env[k] || String(process.env[k]).trim() === "");
if (missing.length) {
  console.error(`[config] MISSING env vars: ${missing.join(", ")} — set them in hPanel → Environment variables`);
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "vedicupchar-fallback-jwt-secret-change-me-0123456789abcdef";
  console.warn("[config] JWT_SECRET missing — using fallback. Set a real one in env vars.");
}
if (process.env.NODE_ENV === "production" && (process.env.JWT_SECRET || "").length < 32) {
  console.warn("[config] JWT_SECRET is short — use a 64+ char random string in production.");
}


export const config = {
  SITE_DOMAIN, SITE_URL, WWW_URL, API_URL, API_BASE_URL,
  CORS_ORIGIN, PUBLIC_URL, WC_SITE_URL, UPLOAD_DIR, MEDIA_DIRS,
  PORT: Number(process.env.PORT || 3000),
  NODE_ENV: process.env.NODE_ENV || "development",
};

console.log(`[config] SITE_DOMAIN=${SITE_DOMAIN}  →  CORS=${CORS_ORIGIN}  PUBLIC_URL=${PUBLIC_URL}  UPLOAD_DIR=${UPLOAD_DIR}  MEDIA_DIRS=${MEDIA_DIRS.join(",")}`);
