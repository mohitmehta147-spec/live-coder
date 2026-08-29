# Hostinger Deploy Guide (VedicUpchar / sync-my-code)

Ek hi Node app frontend + API + uploads sab serve karta hai.

## 1. Requirements
- Hostinger plan with **Node.js app** (Express preset)
- MySQL/Postgres DB (see `server/db.js` for driver in use)
- Node 20+

## 2. Upload code
```sh
# local
npm install
npm run build          # dist/client/ banega — isme index.html (SPA shell) bhi auto-copy hota hai
```
Note: build ke baad `dist/client/index.html` zaroor hona chahiye (SPA shell). Build script
(`package.json`) ye khud copy kar deta hai — agar manually build kiya ho to check kar lein:
```sh
ls dist/client/index.html   # exist karna chahiye
```
Upload the whole project folder (with `dist/`, `server/`, `hostinger-entry.js`, `package.json`) to
`/home/<user>/domains/<domain>/app` via SSH/Git/File Manager. `node_modules` server par install karein:
```sh
npm ci --omit=dev
```

## 3. Environment (.env in project root)
```
NODE_ENV=production
PORT=3000
SITE_DOMAIN=vedicupchar.com

# MySQL (ye 4 zaroori hain, warna /api/health "degraded" dikhayega)
DB_HOST=localhost
DB_PORT=3306
DB_USER=<db user>
DB_PASSWORD=<db password>
DB_NAME=<db name>

JWT_SECRET=<64 char random string>
UPLOAD_DIR=/home/<user>/uploads

# optional
SMTP_HOST=... SMTP_USER=... SMTP_PASS=...
RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=...
```
NOTE: `VITE_API_URL` production me set NA karein (same origin). Wo sirf local preview ke liye hai.
Sirf `SITE_DOMAIN` set karne se CORS_ORIGIN, PUBLIC_URL, SITE_URL auto derive hote hain (`server/config.js`).

## 4. Database (SQL)
Poora schema `server/schema.sql` me hai (29 tables + indexes).
```sh
# Postgres
psql "$DATABASE_URL" -f server/schema.sql
# MySQL
mysql -u user -p dbname < server/schema.sql
```
Admin user banane ke liye:
```sh
node server/scripts/create-admin.js
```
Health check: `node server/scripts/health-check.js`

## 5. Start the app
Hostinger Node panel me:
- **Entry file**: `hostinger-entry.js`
- **App root**: project folder
- **Start command**: `npm start` (ya PM2)

PM2 ke saath (SSH):
```sh
pm2 start ecosystem.config.cjs --env production
pm2 save && pm2 startup
```

## 6. Reverse proxy
Agar apna VPS/nginx hai to `deploy/nginx.conf` copy karein (`/etc/nginx/sites-available/`), domain badlein, phir:
```sh
nginx -t && systemctl reload nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Shared Hostinger hosting par LiteSpeed automatically port 3000 par proxy karta hai — nginx ki zarurat nahi.

## 7. Verify
- `https://yourdomain.com` → site khulni chahiye
- `https://yourdomain.com/api/health` → `{ ok: true }`
- Uploads `UPLOAD_DIR` me save ho rahe hain
