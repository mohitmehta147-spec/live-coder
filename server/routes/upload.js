import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuid } from "uuid";
import { optionalAuth } from "../middleware/auth.js";

const r = Router();
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function safeFolder(req) {
  const raw = String(req.query.folder || req.body?.folder || "misc");
  // allow nested folders (bucket/subdir) but strip traversal + odd chars
  const cleaned = raw
    .split("/")
    .map((s) => s.replace(/[^a-z0-9\-_]/gi, ""))
    .filter(Boolean)
    .join("/");
  return cleaned || "misc";
}

/**
 * Keep the client's filename (slugified) so the URL stays predictable and
 * admin previews / DB rows never point at a random uuid the UI does not know.
 * Only when the name would collide do we append a short unique suffix.
 */
function safeFilename(dir, original) {
  const ext = (path.extname(original || "") || "").toLowerCase() || ".bin";
  const base =
    path
      .basename(original || "", path.extname(original || ""))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "file";
  let name = `${base}${ext}`;
  if (fs.existsSync(path.join(dir, name))) {
    name = `${base}-${uuid().slice(0, 8)}${ext}`;
  }
  return name;
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const p = path.join(UPLOAD_DIR, safeFolder(req));
    fs.mkdirSync(p, { recursive: true });
    cb(null, p);
  },
  filename: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, safeFolder(req));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, safeFilename(dir, file.originalname));
  },
});
const ALLOWED = /^(image|video|application\/pdf)/;
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => ALLOWED.test(file.mimetype) ? cb(null, true) : cb(new Error("file type not allowed")),
});

function describe(file) {
  const rel = path.relative(UPLOAD_DIR, file.path).replace(/\\/g, "/");
  // Use the "{{API}}" token so the URL stays portable across domains; the
  // frontend shim resolves it to the live API origin on every response.
  return { url: `{{API}}/uploads/${rel}`, path: rel, size: file.size, mime: file.mimetype };
}

r.post("/", optionalAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });
  res.json(describe(req.file));
});

r.post("/many", optionalAuth, upload.array("files", 10), (req, res) => {
  res.json({ files: (req.files || []).map(describe) });
});

// DELETE /api/upload?folder=bucket   body: { paths: ["a.jpg", "sub/b.jpg"] }
r.delete("/", optionalAuth, (req, res) => {
  const folder = safeFolder(req);
  const raw = Array.isArray(req.body?.paths)
    ? req.body.paths
    : [req.body?.path, req.body?.url].filter(Boolean);
  // Accept plain paths, "{{API}}/uploads/..." tokens and absolute URLs alike.
  const paths = raw.map((p) =>
    String(p || "")
      .replace(/^\{\{API\}\}/, "")
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/^\/?uploads\//, "")
  );
  const removed = [];
  for (const p of paths) {
    const rel = String(p || "").replace(/^\/+/, "");
    if (!rel || rel.includes("..")) continue;
    // accept both "file.jpg" and "bucket/file.jpg"
    const candidates = [
      path.join(UPLOAD_DIR, folder, rel),
      path.join(UPLOAD_DIR, rel),
    ];
    for (const abs of candidates) {
      if (!abs.startsWith(UPLOAD_DIR)) continue;
      try {
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
          fs.unlinkSync(abs);
          removed.push(rel);
          break;
        }
      } catch { /* ignore */ }
    }
  }
  res.json({ removed });
});

// Multer/file errors must come back as JSON so the admin UI can show a real
// message instead of a generic 500 ("Save failed").
r.use((err, _req, res, _next) => {
  const msg = err?.code === "LIMIT_FILE_SIZE"
    ? "File too large (max 15MB)"
    : err?.message || "upload failed";
  console.error("[upload]", msg);
  res.status(400).json({ error: msg });
});

export default r;
