import "dotenv/config";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { q } from "../db.js";

const mobile   = process.argv[2] || process.env.ADMIN_MOBILE || "9999999999";
const password = process.argv[3] || process.env.ADMIN_PASSWORD || "Admin@12345";
const name     = process.argv[4] || process.env.ADMIN_NAME || "Admin";

const existing = await q("SELECT id FROM profiles WHERE phone=? LIMIT 1", [mobile]);
const hash = await bcrypt.hash(password, 10);
let userId;
if (existing.length) {
  userId = existing[0].id;
  await q("UPDATE profiles SET password_hash=?, full_name=?, updated_at=NOW() WHERE id=?", [hash, name, userId]);
} else {
  userId = uuid();
  await q(
    "INSERT INTO profiles (id, full_name, phone, password_hash, created_at, updated_at) VALUES (?,?,?,?,NOW(),NOW())",
    [userId, name, mobile, hash]
  );
}
await q(
  "INSERT IGNORE INTO user_roles (id, user_id, role, created_at) VALUES (?,?,?,NOW())",
  [uuid(), userId, "admin"]
);
console.log(`✓ Admin ready: ${mobile} / ${password}`);
process.exit(0);
