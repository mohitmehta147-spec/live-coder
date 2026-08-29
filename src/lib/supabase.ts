import { cachedGet, invalidate } from "@/lib/http-cache";
// =============================================================================
//  VedicUpchar Standalone Client
//  ---------------------------------------------------------------------------
//  This file is a 100% custom compatibility layer. It intentionally does NOT
//  import from "@supabase/supabase-js" (that dependency is NOT installed in
//  this project) and it does NOT talk to any Supabase URL.
//
//  Every network call routes to the Node.js + Express REST API defined by
//  VITE_API_URL — that is your own Hostinger backend and nothing else.
//
//  The shape of the exported `supabase` object mimics the old client so the
//  existing UI code keeps compiling unchanged, but under the hood:
//     supabase.from(t).select/insert/update/delete/upsert  -> /api/rest/:t
//     supabase.auth.*                                      -> /api/auth/*
//     supabase.storage.from(b).upload/getPublicUrl/...     -> /api/upload
//     supabase.functions.invoke(name, {body})              -> /api/functions/:name
//     supabase.rpc(name, args)                             -> /api/rpc/:name
// =============================================================================

// Single-app deploy: Express serves the React build, the REST API and /uploads
// from the SAME origin, so an empty base ("") is the correct default.
// VITE_API_URL is only needed if you host the API on a different domain.
const API_BASE: string =
  ((import.meta.env.VITE_API_URL as string) || "").replace(/\/$/, "");

const TOKEN_KEY = "vu_auth_token";
const USER_KEY  = "vu_auth_user";
const isBrowser = typeof window !== "undefined" && typeof localStorage !== "undefined";

// ---------- Session storage --------------------------------------------------
type StoredUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, any>;
  role?: string;
};
type Session = { access_token: string; user: StoredUser } | null;

const listeners: Array<(event: string, session: Session) => void> = [];
function emitAuth(event: string) {
  const session = getSession();
  listeners.forEach((cb) => { try { cb(event, session); } catch {} });
}
function getToken(): string | null { return isBrowser ? localStorage.getItem(TOKEN_KEY) : null; }
function getStoredUser(): StoredUser | null {
  if (!isBrowser) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
// The API returns a flat profile row ({id, full_name, phone, email, role}).
// UI code reads Supabase-style `user_metadata.full_name` / `user.phone`, so we
// normalise once here — this is what makes checkout auto-fill work.
function normalizeUser(u: any): StoredUser {
  const raw = u || {};
  const meta = { ...(raw.user_metadata || {}), ...(raw.metadata || {}) };
  const phone = String(raw.phone || meta.phone || meta.mobile || "").replace(/\D/g, "").slice(-10);
  const full_name = raw.full_name || meta.full_name || meta.name || "";
  const rawEmail = raw.email || meta.contact_email || meta.email || "";
  const email = rawEmail && !/@phone\.local$/i.test(rawEmail) ? rawEmail : "";
  return {
    ...raw,
    id: raw.id || raw.user_id || raw.sub,
    phone,
    email: email || null,
    role: raw.role || "user",
    user_metadata: { ...meta, full_name, phone, contact_email: email },
  };
}
function getSession(): Session {
  const t = getToken(); const u = getStoredUser();
  return t && u ? { access_token: t, user: u } : null;
}
function setSession(token: string, user: StoredUser) {
  if (!isBrowser) return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(normalizeUser(user)));
  emitAuth("SIGNED_IN");
}
function clearSession() {
  if (!isBrowser) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  emitAuth("SIGNED_OUT");
}

// ---------- Low-level fetch --------------------------------------------------
// Media URLs stored in the database use the token "{{API}}" as a portable
// placeholder for the backend origin. We swap it for the real API base on
// every response so <img src> tags resolve regardless of deploy domain.
const MEDIA_TOKEN = /\{\{API\}\}/g;
// Hostinger CDN may retain an older placeholder response for an upload URL.
// Changing this value on deploy gives restored files a fresh cache key.
const MEDIA_CACHE_VERSION = "20260829-1";

function localUploadUrl(pathname: string): string {
  const [rawPath, query = ""] = pathname.split("?", 2);
  // Legacy blog rows were saved as /uploads/blogs/<file>, while Hostinger
  // stores blog media inside uploads/product-images/blogs/. Keep old DB rows
  // working without requiring a bulk database rewrite.
  const path = rawPath.replace(/^\/uploads\/blogs\//i, "/uploads/product-images/blogs/");
  const params = new URLSearchParams(query);
  params.set("media_v", MEDIA_CACHE_VERSION);
  const resolved = `${path}?${params.toString()}`;
  return API_BASE ? `${API_BASE}${resolved}` : resolved;
}

function refreshEmbeddedUploadUrls(value: string): string {
  return value.replace(
    /(^|["'(=\s])(\/uploads\/[^"')\s<>]+)/gi,
    (_match, prefix: string, uploadPath: string) => `${prefix}${localUploadUrl(uploadPath)}`,
  );
}

// Columns that were arrays/JSON in PostgreSQL. MySQL stores them as text, so
// decode defensively here too — components call .map()/.join() on them.
const JSON_COLUMNS = new Set([
  "file_urls", "images", "tags", "sizes", "features", "faqs", "benefits",
  "ingredients", "variations", "variant_matrix", "shipping_address", "items",
  "metadata", "row_data",
]);

// MySQL DECIMAL columns arrive as strings ("999.00"). Convert to numbers so
// price math / sale detection works everywhere.
const NUMERIC_COLUMNS = new Set([
  "price", "mrp", "sale_price", "rating", "total", "subtotal", "discount",
  "discount_amount", "shipping_charge", "shipping_cost", "tax", "tax_amount",
  "amount", "total_amount", "refund_amount", "min_order_amount", "max_discount",
  "discount_value", "unit_price", "line_total",
]);

function decodeColumn(key: string, value: any) {
  if (typeof value !== "string") return value;
  if (NUMERIC_COLUMNS.has(key)) {
    const n = Number(value);
    return value.trim() !== "" && !Number.isNaN(n) ? n : value;
  }
  if (!JSON_COLUMNS.has(key)) return value;
  const t = value.trim();
  if (!t || t === "null") return null;
  if (t.startsWith("[") || t.startsWith("{")) {
    try { return JSON.parse(t); } catch { /* ignore */ }
    if (t.startsWith("{") && t.endsWith("}")) {
      const inner = t.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
    }
  }
  return value;
}

// Purane cloud (Supabase/Lovable) ke image URLs ko self-hosted /uploads par
// map karte hain. Server basename se file dhoond leta hai, isliye sirf
// filename bhejna kaafi hai. Lovable ke preview/placeholder assets drop.
const IMG_EXT = /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i;
function rehostMedia(url: string): string {
  // Relative media paths (/uploads/..., /media/...) ko API origin par point karo,
  // warna dev preview inhe apne localhost se load karne ki koshish karta hai.
  if (url.startsWith("/")) {
    if (/^\/uploads\//i.test(url)) return localUploadUrl(url);
    return API_BASE && /^\/(media|storage)\//i.test(url) ? `${API_BASE}${url}` : url;
  }
  if (!/^https?:\/\//i.test(url)) return url;
  if (/lovable\.(app|dev)|lovableproject\.com|__l5e|opengraph-image/i.test(url)) return "";
  if (!/supabase\.(co|in)/i.test(url)) return url;
  if (!IMG_EXT.test(url)) return url;
  try {
    const file = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
    return file ? localUploadUrl(`/uploads/${file}`) : "";
  } catch { return url; }
}

function resolveMedia<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") {
    const resolvedTokens = value.replace(MEDIA_TOKEN, API_BASE);
    return rehostMedia(refreshEmbeddedUploadUrls(resolvedTokens)) as unknown as T;
  }
  if (Array.isArray(value)) return value.map(resolveMedia) as unknown as T;
  if (typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) out[k] = resolveMedia(decodeColumn(k, v));
    return out;
  }
  return value;
}



async function apiFetch(path: string, init: RequestInit = {}, extraHeaders: Record<string,string> = {}) {
  const headers: Record<string,string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string,string> || {}),
    ...extraHeaders,
  };
  const t = getToken();
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const method = (init.method || "GET").toUpperCase();
  const run = async () => {
    const res  = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const text = await res.text();
    const body = text ? (() => { try { return resolveMedia(JSON.parse(text)); } catch { return text.replace(MEDIA_TOKEN, API_BASE); } })() : null;
    return { ok: res.ok, status: res.status, body };
  };

  // Reads: short-lived memory cache + in-flight dedupe.
  // Writes: run, then drop the cache so the UI reflects the change at once.
  if (method === "GET") {
    const key = `rest:${path}:${t ? "auth" : "anon"}`;
    // Admin panel must always show fresh data — use a tiny 2s TTL (keeps
    // in-flight dedupe for bursts) instead of the default 60s/5min cache.
    const isAdmin = getStoredUser()?.role === "admin";
    const cached = await cachedGet(key, run, isAdmin ? 2_000 : undefined);
    if (!cached.ok) invalidate(key);
    return cached;
  }
  const out = await run();
  invalidate();
  return out;
}

// =============================================================================
//  Query builder — mimics PostgREST/supabase-js chaining
// =============================================================================
type Filter = { col: string; op: string; val: any };

class QueryBuilder implements PromiseLike<any> {
  private table: string;
  private method: "GET" | "POST" | "PATCH" | "DELETE" = "GET";
  private filters: Filter[] = [];
  private selectCols = "*";
  private orderStr: string[] = [];
  private limitN?: number;
  private offsetN?: number;
  private singleRow = false;
  private returnRep = false;
  private payload: any = undefined;
  private onConflict?: string;
  private countMode?: string;
  private headOnly = false;
  private orExpr?: string;
  private notFilters: string[] = [];

  constructor(table: string) { this.table = table; }

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    this.selectCols = cols || "*";
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    if (this.method !== "GET" && !this.method) this.method = "GET";
    // if select is chained after insert/update we want representation
    if (this.method !== "GET") this.returnRep = true;
    return this;
  }
  insert(rows: any) { this.method = "POST";   this.payload = rows; return this; }
  update(row:  any) { this.method = "PATCH";  this.payload = row;  return this; }
  delete()          { this.method = "DELETE"; return this; }
  upsert(rows: any, opts?: { onConflict?: string }) {
    this.method = "POST"; this.payload = rows;
    this.onConflict = opts?.onConflict || "id";
    return this;
  }

  // ---- filters --------------------------------------------------------------
  eq (c: string, v: any) { this.filters.push({ col: c, op: "eq",  val: v }); return this; }
  neq(c: string, v: any) { this.filters.push({ col: c, op: "neq", val: v }); return this; }
  gt (c: string, v: any) { this.filters.push({ col: c, op: "gt",  val: v }); return this; }
  gte(c: string, v: any) { this.filters.push({ col: c, op: "gte", val: v }); return this; }
  lt (c: string, v: any) { this.filters.push({ col: c, op: "lt",  val: v }); return this; }
  lte(c: string, v: any) { this.filters.push({ col: c, op: "lte", val: v }); return this; }
  like (c: string, v: string) { this.filters.push({ col: c, op: "like",  val: v }); return this; }
  ilike(c: string, v: string) { this.filters.push({ col: c, op: "ilike", val: v }); return this; }
  is (c: string, v: any) { this.filters.push({ col: c, op: "is",  val: v === null ? "null" : v }); return this; }
  in (c: string, arr: any[]) { this.filters.push({ col: c, op: "in",  val: `(${arr.join(",")})` }); return this; }
  contains(c: string, v: any) { this.filters.push({ col: c, op: "like", val: `%${typeof v==="string"?v:JSON.stringify(v)}%` }); return this; }
  match(obj: Record<string, any>) {
    for (const [k, v] of Object.entries(obj || {})) this.eq(k, v);
    return this;
  }
  or(expr: string) { this.orExpr = expr; return this; }
  not(c: string, op: string, v: any) {
    this.notFilters.push(`${c}=not.${op}.${v === null ? "null" : v}`);
    return this;
  }

  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderStr.push(`${col}.${opts?.ascending === false ? "desc" : "asc"}`);
    return this;
  }
  limit (n: number) { this.limitN  = n; return this; }
  range(from: number, to: number) { this.offsetN = from; this.limitN = to - from + 1; return this; }
  single()      { this.singleRow = true; return this; }
  maybeSingle() { this.singleRow = true; return this; }

  // ---- executor -------------------------------------------------------------
  private buildQuery(): string {
    const p = new URLSearchParams();
    if (this.method === "GET" && this.selectCols) p.set("select", this.selectCols);
    for (const f of this.filters) p.append(f.col, `${f.op}.${f.val}`);
    if (this.orderStr.length) p.set("order", this.orderStr.join(","));
    if (this.limitN != null)  p.set("limit",  String(this.limitN));
    if (this.offsetN != null) p.set("offset", String(this.offsetN));
    if (this.method === "GET" && this.singleRow) p.set("single", "1");
    if (this.method === "POST" && this.onConflict) p.set("on_conflict", this.onConflict);
    if (this.orExpr) p.set("or", this.orExpr);
    if (this.countMode) p.set("count", this.countMode);
    if (this.headOnly) p.set("head", "1");
    let qs = p.toString();
    for (const nf of this.notFilters) qs += (qs ? "&" : "") + nf;
    return qs ? `?${qs}` : "";
  }

  private async run() {
    const qs   = this.buildQuery();
    const path = `/api/rest/${this.table}${qs}`;
    const init: RequestInit = { method: this.method };
    const extra: Record<string,string> = {};
    if (this.method === "POST" || this.method === "PATCH") {
      init.body = JSON.stringify(this.payload ?? {});
      if (this.returnRep) extra["Prefer"] = "return=representation";
    }
    const { ok, status, body } = await apiFetch(path, init, extra);
    if (!ok) return { data: null, error: { message: (body && (body as any).error) || `HTTP ${status}`, status }, count: null };

    if (this.countMode && body && typeof body === "object" && "count" in (body as any)) {
      const b = body as any;
      return { data: this.headOnly ? null : b.data ?? [], error: null, count: b.count ?? 0 };
    }
    if (this.method === "GET" && this.singleRow) return { data: body, error: null };
    if ((this.method === "POST" || this.method === "PATCH") && this.singleRow && Array.isArray(body))
      return { data: (body as any[])[0] || null, error: null };
    return { data: body, error: null, count: Array.isArray(body) ? body.length : null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?:  ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled as any, onrejected as any);
  }
}

// =============================================================================
//  Auth namespace
// =============================================================================
const auth = {
  async signUp({ email, password, phone, options }: any) {
    const { ok, body } = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email, password, phone,
        full_name: options?.data?.full_name || options?.data?.name,
        metadata:  options?.data || {},
      }),
    });
    if (!ok) return { data: { user: null, session: null }, error: { message: (body as any)?.error || "signup failed" } };
    setSession((body as any).token, (body as any).user);
    return { data: { user: (body as any).user, session: getSession() }, error: null };
  },

  async signInWithPassword({ email, phone, password }: any) {
    const { ok, body } = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, phone, password }),
    });
    if (!ok) return { data: { user: null, session: null }, error: { message: (body as any)?.error || "invalid credentials" } };
    setSession((body as any).token, (body as any).user);
    return { data: { user: (body as any).user, session: getSession() }, error: null };
  },

  async signOut() { clearSession(); return { error: null }; },

  async getSession()          { return { data: { session: getSession() }, error: null }; },
  async getUser()             { const s = getSession(); return { data: { user: s?.user || null }, error: null }; },

  // Pull the freshest profile row from the API and refresh the cached session
  async refreshUser() {
    const t = getToken();
    if (!t) return null;
    const { ok, body } = await apiFetch("/api/auth/me");
    if (!ok || !body) return getStoredUser();
    localStorage.setItem(USER_KEY, JSON.stringify(normalizeUser(body)));
    emitAuth("USER_UPDATED");
    return getStoredUser();
  },

  async setSession(session: { access_token: string; refresh_token?: string; user?: StoredUser } | null) {
    if (!session?.access_token) { clearSession(); return { data: { session: null }, error: null }; }
    // No user object supplied (OTP login) -> resolve it from the API instead of
    // storing a bogus {id:"unknown"} which would break order/user relations.
    let user: any = session.user;
    if (!user?.id) {
      localStorage.setItem(TOKEN_KEY, session.access_token);
      const { ok, body } = await apiFetch("/api/auth/me");
      if (!ok || !body?.id) {
        localStorage.removeItem(TOKEN_KEY);
        return { data: { session: null }, error: { message: "Could not load user profile" } };
      }
      user = body;
    }
    setSession(session.access_token, user);
    return { data: { session: getSession() }, error: null };
  },

  async updateUser(attrs: any) {
    const { ok, body } = await apiFetch("/api/auth/update", { method: "POST", body: JSON.stringify(attrs) });
    if (!ok) return { data: { user: null }, error: { message: (body as any)?.error || "update failed" } };
    if ((body as any).user) {
      const t = getToken(); if (t) setSession(t, (body as any).user);
    }
    return { data: { user: (body as any).user || getStoredUser() }, error: null };
  },

  onAuthStateChange(cb: (event: string, session: Session) => void) {
    listeners.push(cb);
    if (isBrowser) setTimeout(() => cb("INITIAL_SESSION", getSession()), 0);
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY || e.key === USER_KEY) cb("TOKEN_REFRESHED", getSession());
    };
    if (isBrowser) window.addEventListener("storage", onStorage);
    return {
      data: {
        subscription: {
          unsubscribe() {
            const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1);
            if (isBrowser) window.removeEventListener("storage", onStorage);
          },
        },
      },
    };
  },
};

// =============================================================================
//  Storage namespace  -> multipart upload to /api/upload
// =============================================================================
function storageFrom(bucket: string) {
  return {
    async upload(pathInBucket: string, file: File | Blob, opts?: { contentType?: string; upsert?: boolean }) {
      const fd = new FormData();
      fd.append("file", file, (file as File).name || pathInBucket.split("/").pop() || "upload");
      const sub = pathInBucket.split("/").slice(0, -1).join("/");
      const folder = `${bucket}${sub ? `/${sub}` : ""}`;
      fd.append("folder", folder);
      const t = getToken();
      const res = await fetch(`${API_BASE}/api/upload?folder=${encodeURIComponent(folder)}`, {
        method: "POST",
        headers: t ? { Authorization: `Bearer ${t}` } : {},
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { data: null, error: { message: body?.error || `HTTP ${res.status}` } };
      // The API returns the portable "{{API}}" token — swap it for the live
      // origin so admin previews (<img src>) render right after upload.
      const resolvedUrl = String(body.url || "").replace(MEDIA_TOKEN, API_BASE);
      body.url = resolvedUrl;
      // The server may have slugified/deduped the filename — trust ITS path,
      // otherwise getPublicUrl() builds a URL to a file that does not exist.
      const serverPath: string = String(body.path || `${bucket}/${pathInBucket}`);
      const returnedPath = serverPath.startsWith(`${bucket}/`)
        ? serverPath.slice(bucket.length + 1)
        : serverPath;
      cacheUrl(`${bucket}/${returnedPath}`, resolvedUrl);
      cacheUrl(`${bucket}/${pathInBucket}`, resolvedUrl);
      return { data: { path: returnedPath, fullPath: serverPath, publicUrl: resolvedUrl }, error: null };
    },
    getPublicUrl(pathInBucket: string) {
      if (/^https?:\/\//i.test(pathInBucket)) return { data: { publicUrl: pathInBucket } };
      const publicUrl = readCachedUrl(`${bucket}/${pathInBucket}`)
        || `${API_BASE}/uploads/${bucket}/${pathInBucket}`;
      return { data: { publicUrl } };
    },
    async createSignedUrl(pathInBucket: string, _expiresIn: number) {
      if (/^https?:\/\//i.test(pathInBucket)) return { data: { signedUrl: pathInBucket }, error: null };
      const url = readCachedUrl(`${bucket}/${pathInBucket}`)
        || `${API_BASE}/uploads/${bucket}/${pathInBucket}`;
      return { data: { signedUrl: url }, error: null };
    },
    async createSignedUrls(paths: string[], _expiresIn: number) {
      const data = paths.map(p => ({
        path: p,
        signedUrl: readCachedUrl(`${bucket}/${p}`) || `${API_BASE}/uploads/${bucket}/${p}`,
      }));
      return { data, error: null };
    },
    async remove(paths: string[]) {
      await apiFetch(`/api/upload?folder=${encodeURIComponent(bucket)}`, {
        method: "DELETE", body: JSON.stringify({ paths }),
      });
      for (const p of paths) {
        pathUrlCache.delete(`${bucket}/${p}`);
        persistCache();
      }
      return { data: null, error: null };
    },
  };
}

// Uploaded-URL cache. Persisted in localStorage so an admin page refresh (or a
// second tab) still resolves the exact file the server wrote — earlier this was
// in-memory only, which is why saved product photos "disappeared" after reload.
const CACHE_KEY = "vu_media_url_cache";
const pathUrlCache = new Map<string, string>(loadCache());

function loadCache(): [string, string][] {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const obj = raw ? JSON.parse(raw) : null;
    return obj && typeof obj === "object" ? Object.entries(obj as Record<string, string>) : [];
  } catch { return []; }
}
function persistCache() {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(pathUrlCache)));
  } catch { /* quota — ignore */ }
}
function cacheUrl(key: string, url: string) {
  if (!url) return;
  pathUrlCache.set(key, url);
  persistCache();
}
function readCachedUrl(key: string): string | undefined {
  return pathUrlCache.get(key);
}

// =============================================================================
//  Functions namespace
// =============================================================================
const functions = {
  async invoke(name: string, opts?: { body?: any }) {
    const { ok, status, body } = await apiFetch(`/api/functions/${name}`, {
      method: "POST",
      body: JSON.stringify(opts?.body ?? {}),
    });
    if (!ok) return { data: null, error: { message: (body as any)?.error || `HTTP ${status}`, status } };
    return { data: body, error: null };
  },
};

// =============================================================================
//  RPC (server-side function calls). Delegated to /api/rpc/:name.
// =============================================================================
async function rpc(name: string, args?: Record<string, any>) {
  const { ok, status, body } = await apiFetch(`/api/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(args || {}),
  });
  if (!ok) return { data: null, error: { message: (body as any)?.error || `HTTP ${status}`, status } };
  return { data: body, error: null };
}

// =============================================================================
//  Public surface
// =============================================================================
export const supabase = {
  from: (table: string) => new QueryBuilder(table),
  auth,
  storage: { from: storageFrom },
  functions,
  rpc,
  // Realtime is not supported in the standalone build. Return a no-op channel
  // so callers that opportunistically subscribe don't throw.
  channel: (_name: string) => ({
    on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
    subscribe: () => ({ unsubscribe: () => {} }),
    unsubscribe: () => {},
  }),
  removeChannel: () => {},
};

export default supabase;

// On boot, silently re-sync the cached user with the profile row on the server
// so a name/email saved earlier is never asked for again.
if (isBrowser && localStorage.getItem(TOKEN_KEY)) {
  auth.refreshUser().catch(() => {});
}
