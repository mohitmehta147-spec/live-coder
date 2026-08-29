#!/usr/bin/env node
/**
 * Daily MySQL backup (mysqldump) + uploads snapshot rotation.
 *
 * Manual run : npm run db:backup
 * Cron (daily 3 AM, keeps last 14 days):
 *   0 3 * * * cd /home/USER/domains/vedicupchar.com/app && /usr/bin/node server/scripts/backup-db.js >> logs/backup.log 2>&1
 */
import "dotenv/config";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const DIR = path.resolve(process.env.BACKUP_DIR || "./backups");
const KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS || 14);
fs.mkdirSync(DIR, { recursive: true });

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const file = path.join(DIR, `db-${stamp}.sql`);

const args = [
  `-h${process.env.DB_HOST || "localhost"}`,
  `-P${process.env.DB_PORT || 3306}`,
  `-u${process.env.DB_USER}`,
  `-p${process.env.DB_PASSWORD}`,
  "--single-transaction",
  "--quick",
  "--default-character-set=utf8mb4",
  "--no-tablespaces",
  process.env.DB_NAME,
];

try {
  const out = execFileSync("mysqldump", args, { maxBuffer: 1024 * 1024 * 512 });
  fs.writeFileSync(file, out);
  console.log(`[backup] ${file} (${(out.length / 1048576).toFixed(1)} MB)`);
} catch (e) {
  console.error("[backup] mysqldump failed:", e.message);
  process.exit(1);
}

// rotate old dumps
const cutoff = Date.now() - KEEP_DAYS * 86400000;
for (const f of fs.readdirSync(DIR)) {
  if (!f.startsWith("db-") || !f.endsWith(".sql")) continue;
  const p = path.join(DIR, f);
  if (fs.statSync(p).mtimeMs < cutoff) {
    fs.unlinkSync(p);
    console.log(`[backup] removed old ${f}`);
  }
}
console.log("[backup] done");
