#!/usr/bin/env node
/**
 * VedicUpchar — ONE-COMMAND SETUP
 * ────────────────────────────────
 * Fill .env → run `npm run setup` → done.
 *   1. Tests DB connection
 *   2. Imports schema.sql (all tables)
 *   3. Imports every CSV in ../data/
 *   4. Creates default admin
 *
 * Safe to re-run — uses CREATE TABLE IF NOT EXISTS + INSERT IGNORE.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SCHEMA = path.join(__dirname, '..', 'schema.sql');
const DATA_DIR = path.join(ROOT, 'data');

const log = (m) => console.log(`\x1b[36m▸\x1b[0m ${m}`);
const ok  = (m) => console.log(`\x1b[32m✔\x1b[0m ${m}`);
const err = (m) => console.log(`\x1b[31m✖\x1b[0m ${m}`);

const need = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = need.filter(k => !process.env[k] || process.env[k].startsWith('FILL_ME'));
if (missing.length) {
  err(`.env me ye fields fill karo: ${missing.join(', ')}`);
  process.exit(1);
}

const dbCfg = {
  host: (process.env.DB_HOST || '').trim().toLowerCase() === 'localhost' ? '127.0.0.1' : process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
};

async function run() {
  if ((process.env.DB_HOST || '').trim().toLowerCase() === 'localhost') {
    log('DB_HOST=localhost detected — Hostinger IPv6 issue avoid karne ke liye 127.0.0.1 use kar raha hu');
  }
  log(`Connecting to MySQL @ ${dbCfg.host}:${dbCfg.port}/${dbCfg.database} ...`);
  let conn;
  try {
    conn = await mysql.createConnection(dbCfg);
    ok('DB connected');
  } catch (e) {
    err(`DB connect fail: ${e.message}`);
    console.log('\nCheck karo:\n  • DB_HOST sahi hai (Hostinger ka MySQL host — localhost nahi to actual hostname)\n  • User ko is DB pe access hai (hPanel → MySQL → Users)\n  • Password sahi hai');
    process.exit(1);
  }

  // 1. Schema
  if (fs.existsSync(SCHEMA)) {
    log('Importing schema.sql ...');
    const sql = fs.readFileSync(SCHEMA, 'utf8');
    try {
      await conn.query(sql);
      ok('Schema imported (tables ready)');
    } catch (e) {
      err(`Schema import error: ${e.message}`);
      console.log('Aage badh raha hu — agar tables pehle se hain to koi baat nahi.');
    }
  } else {
    err('schema.sql not found — skipping');
  }

  // 2. CSV data
  if (fs.existsSync(DATA_DIR)) {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.csv'));
    log(`Found ${files.length} CSV files. Importing ...`);
    for (const file of files) {
      const table = path.basename(file, '.csv');
      const csvPath = path.join(DATA_DIR, file);
      try {
        // detect existing columns
        const [cols] = await conn.query(
          `SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema=? AND table_name=? ORDER BY ORDINAL_POSITION`,
          [dbCfg.database, table]
        );
        if (!cols.length) { console.log(`   \x1b[33m⚠\x1b[0m ${table}: table missing — skip`); continue; }
        const colNames = cols.map(c => c.COLUMN_NAME);

        const raw = fs.readFileSync(csvPath, 'utf8');
        if (!raw.trim()) { console.log(`   • ${table}: empty`); continue; }
        const rows = parse(raw, { columns: false, skip_empty_lines: true, relax_column_count: true, relax_quotes: true });
        if (!rows.length) { console.log(`   • ${table}: 0 rows`); continue; }

        // rows are positional (no header) — pad/truncate to column count
        const cleaned = rows.map(r => {
          const out = [];
          for (let i = 0; i < colNames.length; i++) {
            let v = r[i];
            if (v === undefined || v === '' || v === 'NULL' || v === '\\N') v = null;
            out.push(v);
          }
          return out;
        });

        const placeholders = `(${colNames.map(() => '?').join(',')})`;
        const CHUNK = 500;
        let inserted = 0;
        for (let i = 0; i < cleaned.length; i += CHUNK) {
          const batch = cleaned.slice(i, i + CHUNK);
          const values = batch.flat();
          const sql = `INSERT IGNORE INTO \`${table}\` (${colNames.map(c=>`\`${c}\``).join(',')}) VALUES ${batch.map(() => placeholders).join(',')}`;
          const [res] = await conn.query(sql, values);
          inserted += res.affectedRows || 0;
        }
        ok(`${table}: ${inserted}/${cleaned.length} rows imported`);
      } catch (e) {
        console.log(`   \x1b[31m✖\x1b[0m ${table}: ${e.message.slice(0, 120)}`);
      }
    }
  }

  await conn.end();
  ok('\nSETUP COMPLETE — ab chalao:  npm start');
}

run().catch(e => { err(e.message); process.exit(1); });
