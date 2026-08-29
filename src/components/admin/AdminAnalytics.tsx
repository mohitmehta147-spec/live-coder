import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { TrendingUp, ShoppingBag, IndianRupee, Package, RefreshCw } from "lucide-react";

type Preset = 7 | 30 | 90 | 0; // 0 = custom

// Convert a Date to YYYY-MM-DD in IST timezone
const istDateKey = (d: Date) => {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 10);
};

const todayIST = () => istDateKey(new Date());
const addDaysIST = (key: string, n: number) => {
  const d = new Date(key + "T00:00:00+05:30");
  d.setDate(d.getDate() + n);
  return istDateKey(d);
};

const AdminAnalytics = () => {
  const [preset, setPreset] = useState<Preset>(30);
  const [fromDate, setFromDate] = useState<string>(addDaysIST(todayIST(), -29));
  const [toDate, setToDate] = useState<string>(todayIST());
  const [stats, setStats] = useState({ revenue: 0, orders: 0, avg: 0, customers: 0 });
  const [daily, setDaily] = useState<{ date: string; revenue: number; orders: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const applyPreset = (days: Preset) => {
    setPreset(days);
    if (days === 0) return;
    setToDate(todayIST());
    setFromDate(addDaysIST(todayIST(), -(days - 1)));
  };

  const load = async () => {
    setLoading(true);
    // IST day boundaries -> UTC ISO for query
    const sinceUtc = new Date(fromDate + "T00:00:00+05:30").toISOString();
    const untilUtc = new Date(toDate + "T23:59:59.999+05:30").toISOString();

    // Page through all matching orders (Supabase caps each request at 1000)
    const chunk = 1000;
    let from = 0;
    let all: any[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, created_at, customer_phone, items, status")
        .gte("created_at", sinceUtc)
        .lte("created_at", untilUtc)
        .neq("status", "cancelled")
        .order("created_at", { ascending: true })
        .range(from, from + chunk - 1);
      if (error) break;
      const batch = data || [];
      all = all.concat(batch);
      if (batch.length < chunk) break;
      from += chunk;
    }

    const revenue = all.reduce((s, o) => s + Number(o.total || 0), 0);
    const customers = new Set(all.map(o => o.customer_phone).filter(Boolean)).size;
    setStats({ revenue, orders: all.length, avg: all.length ? revenue / all.length : 0, customers });

    // Build day buckets across full IST date range
    const byDay: Record<string, { revenue: number; orders: number }> = {};
    let cursor = fromDate;
    while (cursor <= toDate) {
      byDay[cursor] = { revenue: 0, orders: 0 };
      cursor = addDaysIST(cursor, 1);
    }
    all.forEach(o => {
      const key = istDateKey(new Date(o.created_at));
      if (byDay[key]) {
        byDay[key].revenue += Number(o.total || 0);
        byDay[key].orders += 1;
      }
    });
    setDaily(Object.entries(byDay).map(([date, v]) => ({ date, ...v })));

    // Top products — try order_items first, fallback to json items
    const orderIds = all.map(o => o.id);
    const prodMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    if (orderIds.length) {
      let oFrom = 0;
      let items: any[] = [];
      while (oFrom < orderIds.length) {
        const slice = orderIds.slice(oFrom, oFrom + 200);
        const { data } = await supabase.from("order_items").select("order_id, product_name, quantity, price").in("order_id", slice);
        items = items.concat(data || []);
        oFrom += 200;
      }
      items.forEach((it: any) => {
        const name = it.product_name || "Unknown";
        const qty = Number(it.quantity || 1);
        const price = Number(it['price'] || 0);
        if (!prodMap[name]) prodMap[name] = { name, qty: 0, revenue: 0 };
        prodMap[name].qty += qty;
        prodMap[name].revenue += qty * price;
      });
      // Fallback for orders with no order_items rows
      const haveItemsFor = new Set(items.map((i: any) => i.order_id));
      all.filter(o => !haveItemsFor.has(o.id)).forEach(o => {
        const its = Array.isArray(o.items) ? o.items : [];
        its.forEach((it: any) => {
          const name = it.product_name || it.name || "Unknown";
          const qty = Number(it.quantity || it.qty || 1);
          const price = Number(it['price'] || 0);
          if (!prodMap[name]) prodMap[name] = { name, qty: 0, revenue: 0 };
          prodMap[name].qty += qty;
          prodMap[name].revenue += qty * price;
        });
      });
    }
    setTopProducts(Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [fromDate, toDate]);

  const maxRev = useMemo(() => Math.max(...daily.map(d => d.revenue), 1), [daily]);

  return (
    <div>
      <div className="sticky top-0 z-30 bg-background -mx-3 sm:mx-0 px-3 sm:px-0 pt-2 pb-3 border-b border-border mb-3 shadow-sm">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 className="text-2xl font-bold text-foreground">📊 Sales Analytics</h2>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-secondary text-secondary-foreground hover:opacity-90">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <div className="bg-card rounded-xl border border-border p-3 flex flex-wrap items-center gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => applyPreset(d as Preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${preset === d ? "bg-primary text-primary-foreground" : "bg-background border border-border hover:bg-muted"}`}>
              Last {d} days
            </button>
          ))}
          <button onClick={() => setPreset(0)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${preset === 0 ? "bg-primary text-primary-foreground" : "bg-background border border-border hover:bg-muted"}`}>
            Custom
          </button>
          <div className="flex items-center gap-1 ml-auto flex-wrap">
            <label className="text-[11px] text-muted-foreground">From</label>
            <input type="date" value={fromDate} max={toDate}
              onChange={e => { setPreset(0); setFromDate(e.target.value); }}
              className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background" />
            <label className="text-[11px] text-muted-foreground ml-2">To</label>
            <input type="date" value={toDate} min={fromDate} max={todayIST()}
              onChange={e => { setPreset(0); setToDate(e.target.value); }}
              className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background" />
          </div>
        </div>
      </div>

      {loading ? <p className="text-center py-12 text-muted-foreground">Loading analytics...</p> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={IndianRupee} label="Revenue" value={`₹${stats.revenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} />
            <StatCard icon={ShoppingBag} label="Orders" value={stats.orders.toString()} />
            <StatCard icon={TrendingUp} label="Avg Order Value" value={`₹${Math.round(stats.avg).toLocaleString("en-IN")}`} />
            <StatCard icon={Package} label="Unique Customers" value={stats.customers.toString()} />
          </div>

          <div className="bg-card rounded-xl border border-border p-5 mb-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-semibold">Daily Revenue ({daily.length} days)</h3>
              <span className="text-xs text-muted-foreground">{fromDate} → {toDate} (IST)</span>
            </div>
            {daily.every(d => d.revenue === 0) ? (
              <p className="text-center py-10 text-sm text-muted-foreground">No revenue in this period.</p>
            ) : (
              <>
                <div className="flex items-stretch gap-1 h-56 overflow-x-auto">
                  {daily.map(d => (
                    <div key={d.date} className="flex-1 min-w-[10px] h-full flex flex-col justify-end items-center group relative">
                      <div className="w-full bg-primary/80 hover:bg-primary rounded-t transition" style={{ height: `${Math.max((d.revenue / maxRev) * 100, d.revenue > 0 ? 3 : 0)}%` }} />
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-foreground text-background text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                        {d.date}: ₹{d.revenue.toFixed(0)} ({d.orders} orders)
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>{daily[0]?.date}</span><span>{daily[daily.length - 1]?.date}</span>
                </div>
              </>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-4">Top 10 Products</h3>
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr><th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Product</th><th className="text-right px-3 py-2">Qty Sold</th><th className="text-right px-3 py-2">Revenue</th></tr></thead>
              <tbody>
                {topProducts.length === 0 ? <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No sales data</td></tr> :
                topProducts.map((p, i) => (
                  <tr key={p.name} className="border-t border-border">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-right">{p.qty}</td>
                    <td className="px-3 py-2 text-right font-semibold">₹{p.revenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value }: any) => (
  <div className="bg-card rounded-xl border border-border p-4">
    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><Icon className="h-4 w-4" />{label}</div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
  </div>
);

export default AdminAnalytics;
