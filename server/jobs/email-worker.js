import cron from "node-cron";
import { q } from "../db.js";
import { sendMail } from "../lib/mailer.js";

async function tick() {
  let rows;
  try {
    rows = await q("SELECT * FROM email_send_log WHERE status='queued' ORDER BY created_at ASC LIMIT 20");
  } catch { return; }
  for (const row of rows) {
    let meta = {};
    try { meta = JSON.parse(row.metadata || "{}"); } catch {}
    try {
      const supp = await q("SELECT 1 FROM suppressed_emails WHERE email=? LIMIT 1", [row.recipient_email]);
      if (supp.length) {
        await q("UPDATE email_send_log SET status='suppressed' WHERE id=?", [row.id]);
        continue;
      }
      await sendMail({
        to: row.recipient_email,
        subject: meta.subject || row.template_name,
        html: meta.html || `<pre>${JSON.stringify(meta, null, 2)}</pre>`,
      });
      await q("UPDATE email_send_log SET status='sent' WHERE id=?", [row.id]);
    } catch (e) {
      await q("UPDATE email_send_log SET status='failed', error_message=? WHERE id=?",
        [String(e.message || e).slice(0, 500), row.id]);
    }
  }
}

export function startEmailWorker() {
  cron.schedule("*/30 * * * * *", () => { tick().catch(() => {}); });
  console.log("✓ Email worker scheduled (every 30s)");
}
