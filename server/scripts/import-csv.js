// Import all CSV files from ../data into MySQL
// Usage: node scripts/import-csv.js /path/to/data-folder
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { pool } from "../db.js";

const DATA_DIR = process.argv[2] || "../data";

async function importFile(file) {
  const table = path.basename(file, ".csv");
  const raw = fs.readFileSync(file, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, cast: false });
  if (!rows.length) { console.log(`  (empty) ${table}`); return; }
  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `\`${c}\``).join(",");
  const placeholders = cols.map(() => "?").join(",");
  const conn = await pool.getConnection();
  try {
    await conn.query(`SET FOREIGN_KEY_CHECKS=0`);
    for (const row of rows) {
      const values = cols.map(c => {
        const v = row[c];
        if (v === "" || v == null) return null;
        // Keep JSON strings as-is (MySQL parses them)
        return v;
      });
      await conn.execute(
        `INSERT IGNORE INTO \`${table}\` (${colList}) VALUES (${placeholders})`,
        values
      );
    }
    await conn.query(`SET FOREIGN_KEY_CHECKS=1`);
    console.log(`  ✓ ${table}: ${rows.length} rows`);
  } finally { conn.release(); }
}

(async () => {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".csv"));
  console.log(`Importing ${files.length} CSVs from ${DATA_DIR}`);
  for (const f of files) {
    try { await importFile(path.join(DATA_DIR, f)); }
    catch (e) { console.error(`  ✗ ${f}: ${e.message}`); }
  }
  await pool.end();
})();
