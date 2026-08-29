import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Phone, Mail, Package, Download, Users, Pencil, X, Save } from "lucide-react";
import { toast } from "sonner";

type Customer = {
  key: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  orders: number;
  total: number;
  last_order: string;
  first_order: string;
  signup_at: string | null;
  user_id: string | null;
  source: "WordPress" | "Website";
};


const AdminCustomers = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fCity, setFCity] = useState("");
  const [fState, setFState] = useState("");
  const [fPincode, setFPincode] = useState("");
  const [fSource, setFSource] = useState<"all" | "WordPress" | "Website">("all");
  const [dateField, setDateField] = useState<"signup" | "last_order">("last_order");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>({});
  const [saving, setSaving] = useState(false);
  const [historyOf, setHistoryOf] = useState<Customer | null>(null);
  const [signupMap, setSignupMap] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase.from("orders").select(
      "id, customer_name, customer_phone, customer_email, city, state, pincode, total, created_at, order_number, user_id",
    ).order("created_at", { ascending: false });
    setOrders(data || []);
    const userIds = Array.from(new Set((data || []).map((o: any) => o.user_id).filter(Boolean))) as string[];
    if (userIds.length) {
      const map: Record<string, string> = {};
      const CHUNK = 200;
      for (let i = 0; i < userIds.length; i += CHUNK) {
        const slice = userIds.slice(i, i + CHUNK);
        const { data: profs } = await (supabase as any).from("profiles").select("id, created_at").in("id", slice);
        (profs || []).forEach((p: any) => { if (p.id) map[p.id] = p.created_at; });
      }
      setSignupMap(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const customers: Customer[] = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const o of orders) {
      const key = (o.customer_phone || o.customer_email || o.customer_name || "").trim().toLowerCase();
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.orders += 1;
        existing.total += Number(o.total || 0);
        if (!existing.email && o.customer_email) existing.email = o.customer_email;
        if (!existing.city && o.city) existing.city = o.city;
        if (!existing.state && o.state) existing.state = o.state;
        if (!existing.pincode && o.pincode) existing.pincode = o.pincode;
        if (o.created_at < existing.first_order) existing.first_order = o.created_at;
        if (!existing.user_id && o.user_id) existing.user_id = o.user_id;
        if (!existing.signup_at && o.user_id && signupMap[o.user_id]) existing.signup_at = signupMap[o.user_id];
      } else {
        map.set(key, {
          key,
          name: o.customer_name || "—",
          phone: o.customer_phone || "",
          email: o.customer_email,
          city: o.city,
          state: o.state,
          pincode: o.pincode,
          orders: 1,
          total: Number(o.total || 0),
          last_order: o.created_at,
          first_order: o.created_at,
          user_id: o.user_id || null,
          signup_at: o.user_id ? (signupMap[o.user_id] || null) : null,
          source: (o.order_number || "").startsWith("WC-") ? "WordPress" : "Website",
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders);
  }, [orders, signupMap]);

  const filtered = customers.filter(c => {
    if (fCity && !(c.city || "").toLowerCase().includes(fCity.toLowerCase())) return false;
    if (fState && !(c.state || "").toLowerCase().includes(fState.toLowerCase())) return false;
    if (fPincode && !(c.pincode || "").includes(fPincode)) return false;
    if (fSource !== "all" && c.source !== fSource) return false;
    if (fromDate || toDate) {
      const dateStr = dateField === "signup" ? (c.signup_at || c.first_order) : c.last_order;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (fromDate && d < new Date(fromDate + "T00:00:00")) return false;
      if (toDate && d > new Date(toDate + "T23:59:59")) return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c['phone'].includes(q) || (c.email || "").toLowerCase().includes(q) || (c.city || "").toLowerCase().includes(q);
  });

  const startEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c['phone'], email: c.email, city: c.city, state: c.state, pincode: c.pincode });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    // Update all orders matching this customer (by original phone or key)
    const matchingIds = orders
      .filter(o => ((o.customer_phone || o.customer_email || o.customer_name || "").trim().toLowerCase()) === editing.key)
      .map(o => o.id);
    if (matchingIds.length === 0) { setSaving(false); return; }
    const { error } = await supabase.from("orders").update({
      customer_name: form.name,
      customer_phone: form['phone'],
      customer_email: form.email || null,
      city: form.city || null,
      state: form.state || null,
      pincode: form.pincode || null,
    }).in("id", matchingIds);
    setSaving(false);
    if (error) { toast.error("Failed: " + error.message); return; }
    toast.success(`Updated ${matchingIds.length} order(s)`);
    setEditing(null);
    setLoading(true);
    await load();
  };

  const exportCSV = () => {
    const headers = ["Name", "Phone", "Email", "City", "State", "Pincode", "Orders", "Total Spent", "Last Order", "Source"];
    const rows = filtered.map(c => [
      c.name, c['phone'], c.email || "", c.city || "", c.state || "", c.pincode || "",
      c.orders, c.total.toFixed(2), new Date(c.last_order).toLocaleDateString("en-IN"), c.source,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `customers-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-muted-foreground">Loading customers...</p>;

  return (
    <div>
      <div className="sticky top-0 z-30 bg-background -mx-3 sm:mx-0 px-3 sm:px-0 pt-2 pb-3 border-b border-border mb-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Customers ({filtered.length})
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, email, city..."
                className="pl-7 pr-3 py-1.5 border border-border rounded-lg text-xs bg-background w-64" />
            </div>
            <button onClick={() => setShowFilters(s => !s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${showFilters ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-secondary'}`}>
              Filters
            </button>
            <button onClick={exportCSV} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="bg-card rounded-xl border border-border p-3 flex flex-wrap gap-2 items-center">
            <input value={fCity} onChange={e => setFCity(e.target.value)} placeholder="City / District" className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background" />
            <input value={fState} onChange={e => setFState(e.target.value)} placeholder="State" className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background" />
            <input value={fPincode} onChange={e => setFPincode(e.target.value)} placeholder="Pincode" className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background" />
            <select value={fSource} onChange={e => setFSource(e.target.value as any)} className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background">
              <option value="all">All Sources</option>
              <option value="Website">Website</option>
              <option value="WordPress">WordPress</option>
            </select>
            <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-background">
              <button onClick={() => setDateField("signup")} className={`px-2 py-1 rounded-md text-[11px] font-medium ${dateField === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Signup</button>
              <button onClick={() => setDateField("last_order")} className={`px-2 py-1 rounded-md text-[11px] font-medium ${dateField === "last_order" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Last Order</button>
            </div>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} title="From date" className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background" />
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} title="To date" className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background" />
            {(fCity || fState || fPincode || fSource !== "all" || fromDate || toDate) && (
              <button onClick={() => { setFCity(""); setFState(""); setFPincode(""); setFSource("all"); setFromDate(""); setToDate(""); }} className="text-xs text-destructive hover:underline">Clear</button>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto bg-card rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Customer</th>
              <th className="text-left px-3 py-2">Contact</th>
              <th className="text-left px-3 py-2 hidden md:table-cell">Location</th>
              <th className="text-right px-3 py-2">Orders</th>
              <th className="text-right px-3 py-2">Total Spent</th>
              <th className="text-left px-3 py-2 hidden md:table-cell">Last Order</th>
              <th className="text-left px-3 py-2">Source</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.key} className="border-t border-border hover:bg-muted/20">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2 text-xs">
                  <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c['phone']}</div>
                  {c.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> {c.email}</div>}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">
                  {[c.city, c.state, c.pincode].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-3 py-2 text-right font-bold">
                  <button onClick={() => setHistoryOf(c)} className="inline-flex items-center gap-1 hover:text-primary hover:underline">
                    <Package className="h-3 w-3 text-primary" /> {c.orders}
                  </button>
                </td>
                <td className="px-3 py-2 text-right text-primary font-bold">₹{c.total.toLocaleString("en-IN")}</td>
                <td className="px-3 py-2 text-xs hidden md:table-cell">{new Date(c.last_order).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${c.source === "WordPress" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                    {c.source}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg hover:bg-muted text-primary" title="Edit customer">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">No customers found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-xl border border-border max-w-lg w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Edit Customer</h3>
              <button onClick={() => setEditing(null)} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Updates will apply to all {editing.orders} order(s) of this customer.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["name", "Full Name"], ["phone", "Phone"], ["email", "Email"],
                ["city", "City"], ["state", "State"], ["pincode", "Pincode"],
              ].map(([k, label]) => (
                <div key={k} className={k === "name" ? "sm:col-span-2" : ""}>
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <input
                    value={(form as any)[k] || ""}
                    onChange={e => setForm({ ...form, [k]: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background mt-1"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
                <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyOf && (() => {
        const custOrders = orders.filter(o =>
          ((o.customer_phone || o.customer_email || o.customer_name || "").trim().toLowerCase()) === historyOf.key
        );
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setHistoryOf(null)}>
            <div className="bg-card rounded-xl border border-border max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h3 className="text-lg font-bold">{historyOf.name}</h3>
                  <p className="text-xs text-muted-foreground">{historyOf['phone']} • {custOrders.length} order(s) • Total ₹{historyOf.total.toLocaleString("en-IN")}</p>
                </div>
                <button onClick={() => setHistoryOf(null)} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
              </div>
              <div className="overflow-y-auto p-4 space-y-2">
                {custOrders.map(o => (
                  <div key={o.id} className="flex items-center justify-between gap-3 bg-muted/30 rounded-lg p-3 border border-border">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{o.order_number || o.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      {[o.city, o.state].filter(Boolean).length > 0 && (
                        <p className="text-xs text-muted-foreground">{[o.city, o.state].filter(Boolean).join(", ")}</p>
                      )}
                    </div>
                    <p className="font-bold text-primary text-sm shrink-0">₹{Number(o.total || 0).toLocaleString("en-IN")}</p>
                  </div>
                ))}
                {custOrders.length === 0 && <p className="text-center py-6 text-sm text-muted-foreground">No orders</p>}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default AdminCustomers;
