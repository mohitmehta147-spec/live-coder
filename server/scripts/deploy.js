#!/usr/bin/env node
/**
 * VedicUpchar — ONE COMMAND DEPLOY
 * ────────────────────────────────
 *   npm run deploy:all
 *
 * Ye script sab kuch akela karti hai:
 *   1. .env banati/patch karti hai (npm run env wala logic)
 *   2. Database create karti hai (agar permission ho) + connection test
 *   3. schema.sql + data-sql/*.sql import (row count verify)
 *   4. Missing media/images fetch (uploads/ me jo file nahi hai)
 *   5. npm run build (React frontend)
 *   6. Server start (PM2 ho to PM2 se, warna node server/server.js)
 *
 * Options:
 *   --fresh        DB rows truncate karke fresh import
 *   --no-media     media fetch skip
 *   --no-build     vite build skip
 *   --no-start     sirf setup, server start mat karo
 *   KEY=VALUE      .env overrides, e.g. DB_USER=u1_admin DB_PASSWORD=secret
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const overrides = args.filter((a) => /^[A-Z_][A-Z0-9_]*=/.test(a));

const c = (n, m) => `\x1b[${n}m${m}\x1b[0m`;
const step = (m) => console.log(`\n${c(36, "▸")} ${c(1, m)}`);
const ok = (m) => console.log(`${c(32, "✔")} ${m}`);
const warn = (m) => console.log(`${c(33, "⚠")} ${m}`);
const die = (m) => { console.log(`${c(31, "✖")} ${m}`); process.exit(1); };

function run(cmd, cmdArgs, { fatal = true, env } = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0 && fatal) die(`Command fail: ${cmd} ${cmdArgs.join(" ")}`);
  return r.status === 0;
}

const node = process.execPath;
const script = (rel, extra = []) => run(node, [path.join("server", "scripts", rel), ...extra], { fatal: false });

// ── 1. .env ──────────────────────────────────────────────────────────────
step("1/6  .env taiyaar kar raha hu");
run(node, [path.join("server", "scripts", "env-setup.js"), ...overrides]);

// reload env from the (possibly just created) .env
const envPath = path.join(ROOT, ".env");
if (!fs.existsSync(envPath)) die(".env nahi bana — manually banao (.env.example copy karo)");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim().replace(/^["']|["']$/g, "");
  process.env[m[1]] = v;
}

const need = ["DB_USER", "DB_PASSWORD", "DB_NAME"];
const missing = need.filter((k) => !process.env[k] || /change_me|FILL_ME|YourDbPassword/i.test(process.env[k]));
if (missing.length) {
  die(`.env me ye values bharo phir dobara chalao:  ${missing.join(", ")}\n   (Hostinger hPanel → MySQL Databases se milengi)\n   Ya inline do:  npm run deploy:all -- DB_USER=xxx DB_PASSWORD=xxx DB_NAME=xxx`);
}

// ── 2. Database create + connect test ────────────────────────────────────
step("2/6  Database create + connection test");
const mysql = (await import("mysql2/promise")).default;
const HOST = (process.env.DB_HOST || "127.0.0.1").toLowerCase() === "localhost"
  ? "127.0.0.1" : (process.env.DB_HOST || "127.0.0.1");
const base = {
  host: HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

try {
  const c0 = await mysql.createConnection(base);
  try {
    await c0.query(
      `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    ok(`Database ready: ${process.env.DB_NAME}`);
  } catch (e) {
    warn(`CREATE DATABASE skip (${e.code || e.message}) — shared hosting me DB hPanel se banti hai, chalta hai`);
  }
  await c0.end();
} catch (e) {
  warn(`Server-level connect nahi hua (${e.code || e.message}) — direct DB se try kar raha hu`);
}

try {
  const c1 = await mysql.createConnection({ ...base, database: process.env.DB_NAME });
  await c1.query("SELECT 1");
  await c1.end();
  ok(`Connected: ${process.env.DB_USER}@${HOST}/${process.env.DB_NAME}`);
} catch (e) {
  die(`DB connect fail: ${e.message}\n   • DB_HOST/DB_USER/DB_PASSWORD/DB_NAME check karo\n   • Hostinger pe database aur user hPanel → MySQL Databases se bana lo`);
}

// ── 3. Schema + data import ──────────────────────────────────────────────
step("3/6  Schema + data import (data-sql/*.sql)");
const importOk = script("db-import.js", has("--fresh") ? ["--fresh"] : []);
if (!importOk) warn("Import me kuch tables short the — upar ka log dekho (--fresh se dobara try kar sakte ho)");
else ok("Data import complete");

// ── 4. Pending / missing images ──────────────────────────────────────────
step("4/6  Pending images check + fetch");
if (has("--no-media")) warn("--no-media diya hai, skip");
else {
  const fetched = script("fetch-missing-media.js", ["--fetch"]);
  if (!fetched) warn("Kuch media download nahi ho payi — missing-media.txt dekho, ya admin panel se re-upload karo");
  // final report
  script("fetch-missing-media.js");
}

// ── 5. Build ─────────────────────────────────────────────────────────────
step("5/6  Frontend build (vite)");
if (has("--no-build")) warn("--no-build diya hai, skip");
else {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  if (!fs.existsSync(path.join(ROOT, "node_modules"))) {
    warn("node_modules missing — npm install chala raha hu");
    run(npm, ["install"]);
  }
  run(npm, ["run", "build"]);
  ok("dist/ ready");
}

// ── 6. Start ─────────────────────────────────────────────────────────────
step("6/6  Server start");
if (has("--no-start")) {
  ok("Setup complete. Start karne ke liye:  npm start   (ya npm run pm2:start)");
  process.exit(0);
}

const hasPm2 = spawnSync(process.platform === "win32" ? "pm2.cmd" : "pm2", ["-v"], { stdio: "ignore", shell: true }).status === 0;
if (hasPm2 && fs.existsSync(path.join(ROOT, "ecosystem.config.cjs"))) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  run(npm, ["run", "pm2:start"], { fatal: false });
  ok(`Live: http://localhost:${process.env.PORT || 3000}  (pm2 logs vedicupchar)`);
  run(npm, ["run", "health"], { fatal: false });
} else {
  ok(`Starting node server on port ${process.env.PORT || 3000} … (Ctrl+C to stop)`);
  run(node, ["server/server.js"], { fatal: false });
}
