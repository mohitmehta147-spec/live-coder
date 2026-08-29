#!/usr/bin/env node
/**
 * Post-deploy health check.
 *   npm run health                     # hits http://localhost:$PORT/api/health
 *   HEALTH_URL=https://site.com/api/health npm run health
 * Exits 0 when healthy, 1 when not — safe to use in CI / a deploy script.
 */
import "dotenv/config";

const url =
  (process.env.HEALTH_URL && process.env.HEALTH_URL.trim()) ||
  `http://127.0.0.1:${process.env.PORT || 3000}/api/health`;

const t0 = Date.now();
try {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const body = await res.json().catch(() => ({}));
  console.log(`GET ${url} → ${res.status} (${Date.now() - t0}ms)`);
  console.log(JSON.stringify(body, null, 2));
  if (res.ok && body.ok) {
    console.log("\n\x1b[32m✔ HEALTHY\x1b[0m — API up, MySQL connected, uploads writable");
    process.exit(0);
  }
  console.log("\n\x1b[31m✖ UNHEALTHY\x1b[0m — check db/uploads fields above");
  process.exit(1);
} catch (e) {
  console.log(`\x1b[31m✖ Cannot reach ${url}\x1b[0m — ${e.message}`);
  console.log("Is the app running?  pm2 status / npm start");
  process.exit(1);
}
