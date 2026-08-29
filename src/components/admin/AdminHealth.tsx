import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, CheckCircle2, XCircle, RefreshCw, Database, KeyRound, ShoppingCart, Upload, Server, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";

type CheckResult = {
  id: string;
  label: string;
  icon: any;
  ok: boolean | null;
  ms: number | null;
  detail: string;
};

const initialChecks: CheckResult[] = [
  { id: "api", label: "API Server", icon: Server, ok: null, ms: null, detail: "" },
  { id: "db", label: "Database", icon: Database, ok: null, ms: null, detail: "" },
  { id: "auth", label: "Auth API", icon: KeyRound, ok: null, ms: null, detail: "" },
  { id: "orders", label: "Orders API", icon: ShoppingCart, ok: null, ms: null, detail: "" },
  { id: "uploads", label: "Uploads (storage dir)", icon: Upload, ok: null, ms: null, detail: "" },
];

function speedLabel(ms: number | null) {
  if (ms == null) return "";
  if (ms < 200) return "Fast";
  if (ms < 800) return "OK";
  return "Slow";
}

function speedClass(ms: number | null) {
  if (ms == null) return "text-muted-foreground";
  if (ms < 200) return "text-green-600";
  if (ms < 800) return "text-yellow-600";
  return "text-red-600";
}

const AdminHealth = () => {
  const [checks, setChecks] = useState<CheckResult[]>(initialChecks);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const patch = (id: string, p: Partial<CheckResult>) =>
    setChecks(prev => prev.map(c => (c.id === id ? { ...c, ...p } : c)));

  const timed = async (fn: () => Promise<Response>) => {
    const t0 = performance.now();
    const res = await fn();
    return { res, ms: Math.round(performance.now() - t0) };
  };

  const run = useCallback(async () => {
    setRunning(true);
    setChecks(initialChecks);

    // 1) Overall API health (includes DB + uploads dir report)
    let health: any = null;
    try {
      const { res, ms } = await timed(() => fetch("/api/health", { cache: "no-store" }));
      health = await res.json().catch(() => null);
      patch("api", {
        ok: res.ok && health?.ok === true,
        ms,
        detail: health ? `status: ${health.status} • uptime ${health.uptime_seconds}s • ${health.env}` : `HTTP ${res.status}`,
      });
    } catch (e: any) {
      patch("api", { ok: false, ms: null, detail: `unreachable: ${e.message}` });
    }

    // 2) Database (from health report)
    if (health?.db) {
      patch("db", {
        ok: health.db.ok,
        ms: health.db.latency_ms ?? null,
        detail: health.db.ok
          ? `connected • ${health.db.host} • ${health.db.tables ?? "?"} tables`
          : `error: ${health.db.error || "unknown"}`,
      });
    } else {
      patch("db", { ok: false, detail: "no report (API down?)" });
    }

    // 3) Uploads dir (from health report)
    if (health?.uploads) {
      patch("uploads", {
        ok: health.uploads.ok,
        detail: health.uploads.ok ? `writable: ${health.uploads.dir}` : `error: ${health.uploads.error}`,
      });
    } else {
      patch("uploads", { ok: false, detail: "no report (API down?)" });
    }

    // 4) Auth API — expect a clean 400/401 for bad creds (means reachable & validating)
    try {
      const { res, ms } = await timed(() =>
        fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "healthcheck@invalid.local", password: "wrong-password" }),
        })
      );
      const reachable = res.status === 400 || res.status === 401 || res.status === 422;
      patch("auth", {
        ok: reachable,
        ms,
        detail: reachable ? `responding correctly (HTTP ${res.status} for bad creds)` : `unexpected HTTP ${res.status}`,
      });
    } catch (e: any) {
      patch("auth", { ok: false, detail: `unreachable: ${e.message}` });
    }

    // 5) Orders API — with the current admin token
    try {
      const token = localStorage.getItem("vu_auth_token");
      const { res, ms } = await timed(() =>
        fetch("/api/rest/orders?select=id&limit=1", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      );
      patch("orders", {
        ok: res.ok,
        ms,
        detail: res.ok ? "query OK" : `HTTP ${res.status}${res.status === 401 ? " (login expired?)" : ""}`,
      });
    } catch (e: any) {
      patch("orders", { ok: false, detail: `unreachable: ${e.message}` });
    }

    setLastRun(new Date());
    setRunning(false);
  }, []);

  useEffect(() => { run(); }, [run]);

  const okCount = checks.filter(c => c.ok === true).length;
  const allOk = okCount === checks.length;
  const avgMs = (() => {
    const vals = checks.filter(c => c.ms != null).map(c => c.ms as number);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  })();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" /> API Health & Speed
          </h2>
          <p className="text-sm text-muted-foreground">
            Backend REST APIs (auth, orders, uploads, DB) reachability aur response time.
            {lastRun && <> Last run: {lastRun.toLocaleTimeString()}</>}
          </p>
        </div>
        <Button onClick={run} disabled={running} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
          {running ? "Checking…" : "Re-run checks"}
        </Button>
      </div>

      {/* Summary */}
      <div className={`rounded-lg border p-4 flex items-center gap-3 ${allOk ? "border-green-500/40 bg-green-500/5" : "border-yellow-500/40 bg-yellow-500/5"}`}>
        {allOk ? <CheckCircle2 className="h-6 w-6 text-green-600" /> : <XCircle className="h-6 w-6 text-yellow-600" />}
        <div className="flex-1">
          <p className="font-medium">{okCount}/{checks.length} checks passing</p>
          <p className="text-sm text-muted-foreground">
            {allOk ? "Backend fully reachable aur healthy hai." : "Kuch checks fail hue — neeche detail dekhein."}
          </p>
        </div>
        {avgMs != null && (
          <div className="text-right">
            <p className={`text-lg font-semibold flex items-center gap-1 ${speedClass(avgMs)}`}>
              <Gauge className="h-4 w-4" /> {avgMs} ms
            </p>
            <p className="text-xs text-muted-foreground">avg response • {speedLabel(avgMs)}</p>
          </div>
        )}
      </div>

      {/* Per-check rows */}
      <div className="rounded-lg border divide-y">
        {checks.map(c => (
          <div key={c.id} className="flex items-center gap-3 p-4">
            <c.icon className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{c.label}</p>
              <p className="text-sm text-muted-foreground truncate">{running && c.ok === null ? "checking…" : c.detail}</p>
            </div>
            {c.ms != null && (
              <span className={`text-sm font-mono ${speedClass(c.ms)}`}>{c.ms} ms</span>
            )}
            {c.ok === true && <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />}
            {c.ok === false && <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
            {c.ok === null && <RefreshCw className={`h-5 w-5 text-muted-foreground shrink-0 ${running ? "animate-spin" : ""}`} />}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Speed guide: &lt;200ms Fast • 200–800ms OK • &gt;800ms Slow. Auth check galat credentials bhejta hai —
        400/401 response ka matlab API sahi kaam kar rahi hai (koi real login nahi hota).
      </p>
    </div>
  );
};

export default AdminHealth;
