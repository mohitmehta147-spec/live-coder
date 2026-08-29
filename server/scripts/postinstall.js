#!/usr/bin/env node
/**
 * Safe postinstall.
 * Hostinger (and any `npm install --production`) does NOT install devDependencies,
 * so `vite` is missing there and a plain `vite build` crashes the whole install.
 * We only build when vite is actually available; otherwise we keep the
 * pre-built `frontend-dist/` that is committed to the repo.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bin = path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");
const dist = path.join(ROOT, "frontend-dist", "index.html");

if (!fs.existsSync(bin)) {
  if (fs.existsSync(dist)) {
    console.log("[postinstall] vite not installed (production install) — using committed frontend-dist/");
  } else {
    console.log("[postinstall] vite not installed and no frontend-dist/ — run `npm install --include=dev && npm run build`");
  }
  process.exit(0);
}

const r = spawnSync(bin, ["build", "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
if (r.status !== 0) {
  console.log("[postinstall] build failed — keeping existing frontend-dist/ (install continues)");
}
process.exit(0);
