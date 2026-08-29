import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Package, ShoppingCart, Stethoscope, FolderOpen, TrendingUp, IndianRupee, CalendarIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const AdminOverview = ({ onNavigate }: { onNavigate?: (tabId: string) => void }) => {
  const [stats, setStats] = useState({ products: 0, orders: 0, categories: 0, consultations: 0 });
  const [orders, setOrders] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [rangePreset, setRangePreset] = useState("last7");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [productsRes, ordersRes, categoriesRes, consultationsRes] = await Promise.all([
          supabase.from("products").select("id", { count: "exact", head: true }),
          supabase.from("orders").select("*").order("created_at", { ascending: false }),
          supabase.from("categories").select("id", { count: "exact", head: true }),
          supabase.from("consultations").select("id, created_at").order("created_at", { ascending: false }),
        ]);
        const ordersData = ordersRes.data || [];
        const consData = consultationsRes.data || [];
        setStats({
          products: productsRes.count || 0,
          orders: ordersData.length,
          categories: categoriesRes.count || 0,
          consultations: consData.length,
        });
        setOrders(ordersData);
        setConsultations(consData);
        setRecentOrders(ordersData.slice(0, 5));
      } catch {}
    };
    fetchAll();
  }, []);

  const getRangeBounds = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (rangePreset) {
      case "today":
        return { start: startOfToday, end: endOfToday, label: "Today" };
      case "yesterday": {
        const start = new Date(startOfToday);
        start.setDate(start.getDate() - 1);
        const end = new Date(endOfToday);
        end.setDate(end.getDate() - 1);
        return { start, end, label: "Yesterday" };
      }
      case "last30": {
        const start = new Date(startOfToday);
        start.setDate(start.getDate() - 29);
        return { start, end: endOfToday, label: "Last 30 Days" };
      }
      case "month": {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, end: endOfToday, label: "Current Month" };
      }
      case "custom": {
        const start = customFrom ? new Date(customFrom.getFullYear(), customFrom.getMonth(), customFrom.getDate()) : startOfToday;
        const endBase = customTo || customFrom || now;
        const end = new Date(endBase.getFullYear(), endBase.getMonth(), endBase.getDate(), 23, 59, 59, 999);
        return { start, end, label: "Custom Range" };
      }
      case "last7":
      default: {
        const start = new Date(startOfToday);
        start.setDate(start.getDate() - 6);
        return { start, end: endOfToday, label: "Last 7 Days" };
      }
    }
  };

  const { start: rangeStart, end: rangeEnd, label: rangeLabel } = getRangeBounds();

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const createdAt = new Date(order.created_at);
      return createdAt >= rangeStart && createdAt <= rangeEnd;
    });
  }, [orders, rangeStart, rangeEnd]);

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const paidOrders = filteredOrders.filter(o => o.payment_status === "paid");
  const paidRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const dailySales = useMemo(() => {
    const days: Record<string, { date: string; orders: number; revenue: number }> = {};
    const cursor = new Date(rangeStart);

    while (cursor <= rangeEnd) {
      const key = cursor.toISOString().split("T")[0];
      days[key] = {
        date: cursor.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        orders: 0,
        revenue: 0,
      };
      cursor.setDate(cursor.getDate() + 1);
    }

    filteredOrders.forEach((o) => {
      const key = new Date(o.created_at).toISOString().split("T")[0];
      if (days[key]) {
        days[key].orders += 1;
        days[key].revenue += Number(o.total || 0);
      }
    });

    return Object.values(days);
  }, [filteredOrders, rangeStart, rangeEnd]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  const COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6", "#22c55e", "#ef4444"];

  const cards = [
    { label: "Total Orders", value: filteredOrders.length, icon: ShoppingCart, color: "bg-cta-orange/10 text-cta-orange", tab: "orders" },
    { label: "Total Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, icon: IndianRupee, color: "bg-primary/10 text-primary", tab: "orders" },
    { label: "Paid Revenue", value: `₹${paidRevenue.toLocaleString("en-IN")}`, icon: TrendingUp, color: "bg-green-50 text-green-600", tab: "orders" },
    { label: "Products", value: stats.products, icon: Package, color: "bg-blue-50 text-blue-600", tab: "products" },
    { label: "Categories", value: stats.categories, icon: FolderOpen, color: "bg-purple-50 text-purple-600", tab: "categories" },
    { label: "Consultations", value: consultations.filter(c => { const d = new Date(c.created_at); return d >= rangeStart && d <= rangeEnd; }).length, icon: Stethoscope, color: "bg-orange-50 text-orange-600", tab: "consultations" },
  ];

  const statusColor = (s: string) => { switch (s) { case "pending": return "bg-yellow-100 text-yellow-800"; case "confirmed": return "bg-blue-100 text-blue-800"; case "shipped": return "bg-purple-100 text-purple-800"; case "delivered": return "bg-green-100 text-green-800"; case "cancelled": return "bg-red-100 text-red-800"; default: return "bg-muted text-muted-foreground"; } };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground">Sales analysis for {rangeLabel}</p>
        </div>
        <div className="space-y-3 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap gap-2">
            {[
              ["today", "Today"],
              ["yesterday", "Yesterday"],
              ["last7", "Last 7 Days"],
              ["last30", "Last 30 Days"],
              ["month", "Current Month"],
              ["custom", "Custom Date To Date"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRangePreset(value)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                  rangePreset === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-secondary",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {rangePreset === "custom" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className={cn("justify-start text-left font-normal", !customFrom && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4" />
                    {customFrom ? format(customFrom, "dd MMM yyyy") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className={cn("justify-start text-left font-normal", !customTo && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4" />
                    {customTo ? format(customTo, "dd MMM yyyy") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => { const Icon = card.icon; return (<button key={card.label} type="button" onClick={() => onNavigate?.(card.tab)} className="bg-card rounded-xl border border-border p-5 text-left hover:border-primary hover:shadow-md transition cursor-pointer"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center`}><Icon className="h-5 w-5" /></div><div><p className="text-xl font-bold text-foreground">{card.value}</p><p className="text-xs text-muted-foreground">{card.label}</p></div></div></button>); })}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5"><h3 className="font-semibold text-foreground mb-4">📈 Revenue ({rangeLabel})</h3><ResponsiveContainer width="100%" height={250}><LineChart data={dailySales}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" /><YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" /><Tooltip formatter={(value: number) => [`₹${value}`, "Revenue"]} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }} /><Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} dot={{ fill: "var(--primary)" }} /></LineChart></ResponsiveContainer></div>
        <div className="bg-card rounded-xl border border-border p-5"><h3 className="font-semibold text-foreground mb-4">📊 Orders ({rangeLabel})</h3><ResponsiveContainer width="100%" height={250}><BarChart data={dailySales}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" /><YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" /><Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)" }} /><Bar dataKey="orders" fill="var(--primary)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <div className="bg-card rounded-xl border border-border p-5"><h3 className="font-semibold text-foreground mb-4">🥧 Order Status Distribution</h3>{statusData.length > 0 ? (<ResponsiveContainer width="100%" height={250}><PieChart><Pie data={statusData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{statusData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}</Pie><Tooltip /></PieChart></ResponsiveContainer>) : (<p className="text-sm text-muted-foreground text-center py-12">No order data yet</p>)}</div>
        <div className="bg-card rounded-xl border border-border p-5"><h3 className="font-semibold text-foreground mb-4">🕐 Recent Orders</h3>{filteredOrders.slice(0, 5).length > 0 ? (<div className="space-y-3">{filteredOrders.slice(0, 5).map((o) => (<div key={o.id} className="flex items-center justify-between py-2 border-b border-border last:border-0"><div><p className="text-sm font-medium text-foreground">{o.customer_name}</p><p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p></div><div className="text-right"><p className="text-sm font-bold text-primary">₹{o.total}</p><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(o.status)}`}>{o.status}</span></div></div>))}</div>) : (<p className="text-sm text-muted-foreground text-center py-12">No orders yet</p>)}</div>
      </div>
    </div>
  );
};

export default AdminOverview;
