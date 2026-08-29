// Root entry file for Hostinger (Express preset: Entry file = hostinger-entry.js).
//
// IMPORTANT: this must open the HTTP port as fast as possible. Any heavy work
// (DB import, build) before listen() makes LiteSpeed return 503. So we import
// the real app directly; slow tasks run in the background after listen().
//
// LiteSpeed loads this file with require(), so no top-level await here —
// dynamic import() keeps the ESM graph out of the static require path.
import("./server/server.js").catch((err) => {
  console.error("[boot] failed to start server:", err);
});
