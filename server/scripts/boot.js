#!/usr/bin/env node
/**
 * VedicUpchar — SMART BOOT (GitHub → Hostinger Node.js app)
 * ─────────────────────────────────────────────────────────
 * `npm start` isi file ko chalata hai. Ye khud check karke sab set kar deta hai
 * aur phir asli server (server/server.js) start karta hai:
 *
 *   1. .env missing?      → hPanel/system env vars se bana deta hai
 *   2. frontend missing? → clear deployment error log karta hai
 *   3. DB tables empty?   → schema.sql + data-sql/*.sql import kar deta hai
 *   4. Server start
 *
 * Skip flags (env): SKIP_AUTO_BUILD=1, SKIP_AUTO_IMPORT=1
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const node = process.execPath;

const ok = (m) => console.log(`\x1b[32m✔\x1b[0m ${m}`);
const step = (m) => console.log(`\x1b[36m▸\x1b[0m ${m}`);
const warn = (m) => console.log(`\x1b[33m⚠\x1b[0m ${m}`);

function run(cmd, args) {
  return spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" }).status === 0;
}

function loadEnvFile() {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return false;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return true;
}

// ── 1. .env ───────────────────────────────────────────────────────────────
if (!fs.existsSync(path.join(ROOT, ".env"))) {
  step(".env missing — system/hPanel env vars se bana raha hu");
  const pass = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "SITE_DOMAIN", "ADMIN_MOBILE", "ADMIN_PASSWORD"]
    .filter((k) => process.env[k])
    .map((k) => `${k}=${process.env[k]}`);
  run(node, [path.join("server", "scripts", "env-setup.js"), ...pass]);
}
loadEnvFile();

const dbReady = process.env.DB_USER && process.env.DB_NAME &&
  !/change_me|FILL_ME|YourDbPassword/i.test(process.env.DB_PASSWORD || "");
if (!dbReady) warn(".env me DB_USER / DB_PASSWORD / DB_NAME bharo (hPanel → MySQL Databases)");

// ── 2. Frontend build ─────────────────────────────────────────────────────
// frontend-dist is intentionally committed for Hostinger. LiteSpeed starts the app in
// a restricted runtime where spawning npm is unreliable, so never build here.
// The deployment build command still refreshes it via `npm run build`.
if (fs.existsSync(path.join(ROOT, "frontend-dist", "index.html"))) {
  ok("Frontend build ready → frontend-dist/");
} else {
  warn("Frontend build deployment me missing hai — latest GitHub commit redeploy karo");
}

// ── 3. Database import (sirf agar khali ho) ───────────────────────────────
if (dbReady && process.env.SKIP_AUTO_IMPORT !== "1") {
  try {
    const mysql = (await import("mysql2/promise")).default;
    const host = (process.env.DB_HOST || "127.0.0.1").toLowerCase() === "localhost" ? "127.0.0.1" : process.env.DB_HOST;
    const conn = await mysql.createConnection({
      host,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    let empty = true;
    try {
      const [[row]] = await conn.query("SELECT COUNT(*) AS c FROM products");
      empty = Number(row.c) === 0;
    } catch { empty = true; } // table hi nahi hai
    await conn.end();
    if (empty) {
      step("Database khali hai — schema + data import kar raha hu");
      if (run(node, [path.join("server", "scripts", "db-import.js")])) ok("Data import ho gaya");
      else warn("Import me kuch short raha — SSH me `npm run db:import -- --fresh` chalao");
    } else ok("Database me data maujood hai — import skip");
  } catch (e) {
    warn(`DB check skip: ${e.code || e.message}`);
  }
}

// ── 4. Server ─────────────────────────────────────────────────────────────
step("Server start...");
await import(pathToFileURL(path.join(ROOT, "server", "server.js")).href);
