// PM2 process definition — VedicUpchar single Node app (API + React build + uploads)
//   pm2 start ecosystem.config.cjs --env production
//   pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: "vedicupchar",
      script: "server/server.js",
      cwd: __dirname,
      exec_mode: "fork",          // shared hosting: single process (cluster needs >1 CPU)
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      time: true,
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // .env in the project root is still loaded by dotenv inside the app,
      // so DB / SMTP / Razorpay credentials never live in this file.
    },
  ],
};
