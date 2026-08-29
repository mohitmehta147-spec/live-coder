import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { q } from "./db.js";

export async function ensureAdmin() {
  const mobile = process.env.ADMIN_MOBILE;
  const password = process.env.ADMIN_PASSWORD;
  if (!mobile || !password) return;
  try {
    const existing = await q("SELECT id, role FROM profiles WHERE phone=? LIMIT 1", [mobile]);
    const hash = await bcrypt.hash(password, 10);
    let userId;
    if (existing.length) {
      userId = existing[0].id;
      if (existing[0].role !== "admin") await q("UPDATE profiles SET role='admin' WHERE id=?", [userId]);
    } else {
      userId = uuid();
      await q(
        "INSERT INTO profiles (id, full_name, phone, email, password_hash, role, created_at, updated_at) VALUES (?,?,?,?,?, 'admin', NOW(), NOW())",
        [userId, process.env.ADMIN_NAME || "Admin", mobile, process.env.ADMIN_EMAIL || null, hash]
      );
      console.log(`✓ Admin created: ${mobile} / ${password}`);
    }
    // Also register in user_roles table (dual source of truth)
    const roleRow = await q("SELECT id FROM user_roles WHERE user_id=? AND role='admin' LIMIT 1", [userId]);
    if (!roleRow.length) {
      await q("INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?,?, 'admin', NOW())", [uuid(), userId]);
    }
    console.log(`✓ Admin ready: ${mobile}`);
  } catch (e) {
    console.warn("[admin] setup skipped:", e.message);
    console.warn("[admin] Run `npm run setup` first and verify .env DB credentials.");
  }
}

// Keep the global order counter ahead of any order number already imported,
// so freshly placed orders never reuse an existing VU/…/NNNN number.
export async function ensureOrderSequence() {
  try {
    const [row] = await q(
      "SELECT MAX(CAST(SUBSTRING_INDEX(order_number,'/',-1) AS UNSIGNED)) AS mx FROM orders WHERE order_number LIKE 'VU/%'"
    );
    const mx = Number(row?.mx || 0);
    await q(
      "INSERT INTO order_sequence (date_key, counter) VALUES ('global', ?) ON DUPLICATE KEY UPDATE counter=GREATEST(counter, VALUES(counter))",
      [mx]
    );
    console.log(`✓ Order sequence synced (last #${mx})`);
  } catch (e) {
    console.warn("[order-sequence] sync skipped:", e.message);
  }
}

// ---------------------------------------------------------------------------
// Schema self-heal: add columns that newer features need. Safe to run on every
// boot — each column is checked in information_schema first.
// ---------------------------------------------------------------------------
const EXTRA_COLUMNS = [
  ["orders",   "razorpay_order_id",        "VARCHAR(64)"],
  ["orders",   "razorpay_payment_id",      "VARCHAR(64)"],
  ["orders",   "razorpay_signature",       "VARCHAR(255)"],
  ["orders",   "paid_at",                  "DATETIME NULL"],
  ["products", "category_ids",             "LONGTEXT"],
  ["products", "banner_image_mobile",      "TEXT"],
  ["products", "benefits_banner_mobile",   "TEXT"],
  ["products", "ingredients_banner_mobile","TEXT"],
  ["banners",  "image_url_mobile",         "TEXT"],
  ["banners",  "mobile_height",            "VARCHAR(16) DEFAULT 'auto'"],
  ["banners",  "section",                  "VARCHAR(32)"],
  ["products", "base_pack_size",           "DECIMAL(12,2) NULL"],
  ["categories", "image_url",              "TEXT"],
  ["categories", "show_in_navbar",         "TINYINT(1) NOT NULL DEFAULT 1"],
  ["categories", "show_in_concern",        "TINYINT(1) NOT NULL DEFAULT 1"],
  ["categories", "show_in_shop",           "TINYINT(1) NOT NULL DEFAULT 1"],
  ["categories", "show_in_filters",        "TINYINT(1) NOT NULL DEFAULT 1"],
  ["categories", "is_featured",            "TINYINT(1) NOT NULL DEFAULT 0"],
  ["categories", "navbar_group",           "VARCHAR(64) NULL"],
];


// site_settings is a key/value store the admin panel upserts into
// (ON DUPLICATE KEY UPDATE). The imported MySQL schema had no UNIQUE index on
// `key`, so every admin save inserted a duplicate row and the stale row kept
// winning on reload — that is why consultation types "did not save".
async function ensureSettingsKeyUnique() {
  try {
    // 1) value must hold large JSON payloads (consultation types, banners…)
    try { await q("ALTER TABLE `site_settings` MODIFY `value` LONGTEXT NULL"); } catch { /* already fine */ }
    // 2) collapse duplicates, keeping the most recently updated row
    await q(
      "DELETE s1 FROM site_settings s1 JOIN site_settings s2 " +
      "ON s1.`key` = s2.`key` AND (" +
      "  COALESCE(s1.updated_at,'1970-01-01') < COALESCE(s2.updated_at,'1970-01-01') " +
      "  OR (COALESCE(s1.updated_at,'1970-01-01') = COALESCE(s2.updated_at,'1970-01-01') AND s1.id > s2.id))"
    );
    // 3) add the unique index if it is missing
    const idx = await q(
      `SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'site_settings'
          AND INDEX_NAME = 'site_settings_key_unique' LIMIT 1`
    );
    if (!idx.length) {
      await q("ALTER TABLE `site_settings` MODIFY `key` VARCHAR(191) NOT NULL");
      await q("ALTER TABLE `site_settings` ADD UNIQUE KEY `site_settings_key_unique` (`key`)");
      console.log("✓ site_settings.key is now UNIQUE (admin saves persist)");
    }
  } catch (e) {
    console.warn("[schema] site_settings key unique skipped:", e.message);
  }
}

export async function ensureSchema() {
  for (const [table, col, type] of EXTRA_COLUMNS) {
    try {
      const rows = await q(
        `SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
        [table, col]
      );
      if (!rows.length) {
        await q(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${type}`);
        console.log(`✓ Added column ${table}.${col}`);
      }
    } catch (e) {
      console.warn(`[schema] ${table}.${col} skipped:`, e.message);
    }
  }
  await ensureSettingsKeyUnique();
}
