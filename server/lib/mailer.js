import nodemailer from "nodemailer";

let _transport;
export function transporter() {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    tls: { rejectUnauthorized: false },
  });
  return _transport;
}

export async function sendMail({ to, subject, html, text, replyTo }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.log(`[mail:dev] to=${to} subject=${subject}`);
    return { ok: true, dev: true };
  }
  try {
    const info = await transporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to, subject, html, replyTo,
      text: text || (html || "").replace(/<[^>]+>/g, ""),
    });
    return { ok: true, id: info.messageId };
  } catch (e) {
    console.warn("[mail] send failed:", e.message);
    return { ok: false, error: e.message };
  }
}

export const ADMIN_EMAILS = () =>
  String(process.env.ADMIN_NOTIFY_EMAILS || process.env.SMTP_USER || "")
    .split(",").map(s => s.trim()).filter(Boolean);

const esc = (v) => String(v ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const BRAND = process.env.MAIL_BRAND || "VedicUpchar";
const SITE = process.env.SITE_DOMAIN ? `https://${process.env.SITE_DOMAIN}` : "";

export function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff">
    <div style="background:#0f5132;padding:20px 24px;color:#ffffff">
      <div style="font-size:20px;font-weight:bold">${esc(BRAND)}</div>
      <div style="font-size:12px;opacity:.85">India's Trusted Ayurvedic Brand</div>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 16px;font-size:18px;color:#111">${esc(title)}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:16px 24px;background:#fafafa;color:#777;font-size:11px;text-align:center">
      ${esc(BRAND)}${SITE ? ` · <a href="${SITE}" style="color:#0f5132">${SITE.replace(/^https:\/\//, "")}</a>` : ""}
    </div>
  </div></body></html>`;
}

export function table(rows) {
  return `<table cellpadding="6" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:13px;color:#333">
    ${rows.filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) =>
      `<tr><td style="border-bottom:1px solid #eee;color:#777;width:38%">${esc(k)}</td>
           <td style="border-bottom:1px solid #eee;white-space:pre-line"><b>${esc(v)}</b></td></tr>`).join("")}
  </table>`;
}

function itemsTable(items = []) {
  if (!items.length) return "";
  return `<table cellpadding="8" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:13px;margin-top:14px">
    <tr style="background:#f1f5f2;color:#0f5132"><th align="left">Item</th><th align="center">Qty</th><th align="right">Price</th></tr>
    ${items.map(i => `<tr>
      <td style="border-bottom:1px solid #eee">${esc(i.product_name || i.name)}</td>
      <td style="border-bottom:1px solid #eee" align="center">${esc(i.quantity)}</td>
      <td style="border-bottom:1px solid #eee" align="right">${money(i.price)}</td></tr>`).join("")}
  </table>`;
}

/** Order confirmation to the customer + a copy to the admin inbox. */
export async function sendOrderEmails(order) {
  const {
    order_number, customer_name, customer_email, customer_phone,
    address, city, state, pincode, items = [], subtotal, discount, shipping, total,
    payment_method, payment_status, payment_id,
  } = order || {};

  const summary = table([
    ["Order Number", order_number],
    ["Name", customer_name],
    ["Phone", customer_phone],
    ["Email", customer_email],
    ["Address", [address, city, state, pincode].filter(Boolean).join(", ")],
    ["Payment", `${String(payment_method || "cod").toUpperCase()} — ${String(payment_status || "pending").toUpperCase()}`],
    ["Payment ID", payment_id],
    ["Subtotal", subtotal != null ? money(subtotal) : ""],
    ["Discount", discount ? `- ${money(discount)}` : ""],
    ["Shipping", shipping != null ? money(shipping) : ""],
    ["Total", money(total)],
  ]);

  const out = [];
  if (customer_email && /@/.test(customer_email) && !/@phone\.local$/i.test(customer_email)) {
    out.push(await sendMail({
      to: customer_email,
      subject: `Order Confirmed ${order_number || ""} — ${BRAND}`,
      html: layout(`Thank you${customer_name ? `, ${customer_name}` : ""}! Your order is confirmed.`,
        `<p style="font-size:13px;color:#444">We have received your order and it is being processed. You will get an update as soon as it ships.</p>
         ${itemsTable(items)}${summary}`),
    }));
  }
  for (const admin of ADMIN_EMAILS()) {
    out.push(await sendMail({
      to: admin,
      replyTo: customer_email || undefined,
      subject: `🛒 New Order ${order_number || ""} — ${money(total)}`,
      html: layout("New order received", `${itemsTable(items)}${summary}`),
    }));
  }
  return out;
}

/** Order status change (shipped / delivered / cancelled) mail to customer. */
export async function sendOrderStatusEmail(order, status) {
  if (!order?.customer_email || /@phone\.local$/i.test(order.customer_email)) return;
  const titles = {
    confirmed: "Your order is confirmed",
    processing: "Your order is being packed",
    shipped: "Your order has been shipped 🚚",
    delivered: "Your order has been delivered ✅",
    cancelled: "Your order has been cancelled",
  };
  await sendMail({
    to: order.customer_email,
    subject: `${titles[status] || "Order update"} — ${order.order_number || ""}`,
    html: layout(titles[status] || "Order update", table([
      ["Order Number", order.order_number],
      ["Status", String(status || "").toUpperCase()],
      ["Tracking ID", order.tracking_id],
      ["Tracking Link", order.tracking_url],
      ["Total", money(order.total)],
    ])),
  });
}

/** Generic lead / form notification to the admin inbox. */
export async function sendAdminNotification({ formType, subjectLine, fields = {}, siteName }) {
  const rows = Object.entries(fields).map(([k, v]) => [k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), v]);
  for (const admin of ADMIN_EMAILS()) {
    await sendMail({
      to: admin,
      subject: subjectLine || `${formType || "New submission"} — ${siteName || BRAND}`,
      html: layout(formType || "New submission", table(rows)),
    });
  }
}
