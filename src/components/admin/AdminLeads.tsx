import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { trashDelete } from "@/lib/trash";
import { Download, Search, RefreshCw, Phone, MessageSquare, Stethoscope, ShoppingBag, UserPlus, Mail, Trash2 } from "lucide-react";

type LeadSource = "signup" | "signin" | "consultation" | "popup" | "contact" | "order" | "newsletter";
type LeadStatus = "new" | "contacted" | "not_connected" | "completed" | "cancelled" | "";

type Lead = {
  source: LeadSource;
  name: string;
  mobile: string;
  email: string;
  city: string;
  note: string;
  age: string;
  gender: string;
  disease: string;
  created_at: string;
  ref_id: string;
  status: LeadStatus;
};

const sourceMeta: Record<LeadSource, { label: string; color: string; Icon: any }> = {
  signup:       { label: "Sign-up",      color: "bg-blue-100 text-blue-700 border-blue-200",       Icon: UserPlus },
  signin:       { label: "Sign-in",      color: "bg-sky-100 text-sky-700 border-sky-200",          Icon: UserPlus },
  consultation: { label: "Consultation", color: "bg-emerald-100 text-emerald-700 border-emerald-200", Icon: Stethoscope },
  popup:        { label: "Home Popup",   color: "bg-amber-100 text-amber-700 border-amber-200",    Icon: Stethoscope },
  contact:      { label: "Contact",      color: "bg-purple-100 text-purple-700 border-purple-200", Icon: MessageSquare },
  order:        { label: "Order",        color: "bg-orange-100 text-orange-700 border-orange-200", Icon: ShoppingBag },
  newsletter:   { label: "Newsletter",   color: "bg-pink-100 text-pink-700 border-pink-200",       Icon: Mail },
};

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: "new",       label: "New",       color: "bg-red-100 text-red-700 border-red-300" },
  { value: "contacted", label: "Contacted", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "not_connected", label: "Not Connected", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "completed", label: "Completed", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "cancelled", label: "Cancelled", color: "bg-gray-200 text-gray-700 border-gray-300" },
];

// Map DB statuses to our normalized 4-state set
const normalizeStatus = (source: LeadSource, raw: any): LeadStatus => {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return "new";
  if (["pending", "new"].includes(s)) return "new";
  if (["contacted", "in_progress", "in progress", "replied", "confirmed", "shipped"].includes(s)) return "contacted";
  if (["not_connected", "not connected", "no answer", "unreachable", "not reachable", "busy"].includes(s)) return "not_connected";
  if (["completed", "delivered", "done", "resolved"].includes(s)) return "completed";
  if (["cancelled", "canceled", "rejected"].includes(s)) return "cancelled";
  return "new";
};

const PAGE_SIZE = 50;

const AdminLeads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LeadSource | "all">("all");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [eventsRes, consRes, contactsRes, ordersRes, newsRes] = await Promise.all([
        (supabase as any).from("lead_events").select("id, event_type, name, phone, email, city, note, status, created_at").order("created_at", { ascending: false }).limit(5000),
        supabase.from("consultations").select("id, patient_name, mobile, city, disease, age, gender, consultation_type, status, created_at").order("created_at", { ascending: false }).limit(2000),
        (supabase as any).from("contact_inquiries").select("id, name, phone, email, subject, message, status, created_at").order("created_at", { ascending: false }).limit(2000),
        (supabase as any).from("orders").select("id, order_number, customer_name, customer_phone, customer_email, city, status, created_at").order("created_at", { ascending: false }).limit(2000),
        (supabase as any).from("newsletter_subscribers").select("id, email, created_at").order("created_at", { ascending: false }).limit(2000),
      ]);
      const all: Lead[] = [];
      (eventsRes.data || []).forEach((e: any) => {
        const src: LeadSource = e.event_type === "signin" ? "signin" : e.event_type === "popup" ? "popup" : "signup";
        all.push({
          source: src, name: e.name || "(no name)", mobile: e['phone'] || "", email: e.email || "",
          city: e.city || "", note: e.note || (src === "signin" ? "User signed in" : "User account"),
          age: "", gender: "", disease: "",
          created_at: e.created_at || "", ref_id: e.id,
          status: normalizeStatus(src, e.status || "new"),
        });
      });
      (consRes.data || []).forEach((c: any) => {
        const isPopup = (c.consultation_type || "").toLowerCase().includes("popup") || (c.consultation_type || "").toLowerCase().includes("quick inquiry");
        all.push({
          source: isPopup ? "popup" : "consultation",
          name: c.patient_name || "", mobile: c['mobile'] || "", email: "",
          city: c.city || "", note: c.disease || c.consultation_type || "", created_at: c.created_at || "", ref_id: c.id,
          age: c.age || "", gender: c.gender || "", disease: c.disease || "",
          status: normalizeStatus(isPopup ? "popup" : "consultation", c.status),
        });
      });
      (contactsRes.data || []).forEach((c: any) => all.push({
        source: "contact", name: c.name || "", mobile: c['phone'] || "", email: c.email || "",
        city: "", note: c.subject || c.message?.slice(0, 80) || "", created_at: c.created_at || "", ref_id: c.id,
        age: "", gender: "", disease: "",
        status: normalizeStatus("contact", c.status),
      }));
      (ordersRes.data || []).forEach((o: any) => all.push({
        source: "order", name: o.customer_name || "", mobile: o.customer_phone || "", email: o.customer_email || "",
        city: o.city || "", note: o.order_number || "", created_at: o.created_at || "", ref_id: o.id,
        age: "", gender: "", disease: "",
        status: normalizeStatus("order", o.status),
      }));
      (newsRes.data || []).forEach((n: any) => all.push({
        source: "newsletter", name: "", mobile: "", email: n.email || "",
        city: "", note: "Newsletter", created_at: n.created_at || "", ref_id: n.id, status: "",
        age: "", gender: "", disease: "",
      }));
      all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      setLeads(all);
    } catch (e: any) {
      toast({ title: "Load failed", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateStatus = async (lead: Lead, newStatus: LeadStatus) => {
    if (!newStatus) return;
    let dbStatus = newStatus as string;
    if (newStatus === "new") dbStatus = lead.source === "contact" ? "new" : "pending";
    let table: string | null = null;
    let idCol = "id";
    let patch: any = { status: dbStatus };
    if (lead.source === "consultation" || lead.source === "popup") table = "consultations";
    else if (lead.source === "contact") table = "contact_inquiries";
    else if (lead.source === "order") table = "orders";
    else if (lead.source === "signup" || lead.source === "signin") { table = "lead_events"; patch = { status: newStatus }; }
    if (!table) { toast({ title: "Status not editable for this source", variant: "destructive" }); return; }
    const { error } = await (supabase as any).from(table).update(patch).eq(idCol, lead.ref_id);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    setLeads(prev => prev.map(l => l.ref_id === lead.ref_id && l.source === lead.source ? { ...l, status: newStatus } : l));
    toast({ title: `✅ Status → ${newStatus}` });
  };

  const deleteLead = async (lead: Lead) => {
    let table: string | null = null;
    if (lead.source === "consultation" || lead.source === "popup") table = "consultations";
    else if (lead.source === "contact") table = "contact_inquiries";
    else if (lead.source === "newsletter") table = "newsletter_subscribers";
    else if (lead.source === "order") table = "orders";
    else if (lead.source === "signup" || lead.source === "signin") table = "lead_events";
    if (!table) return;
    if (!confirm(`Move this ${sourceMeta[lead.source].label} lead to Trash? You can restore within 30 days.`)) return;
    let err: any = null;
    if (lead.source === "signup" || lead.source === "signin") {
      const r = await (supabase as any).from("lead_events").delete().eq("id", lead.ref_id);
      err = r.error;
    } else {
      const { error } = await trashDelete(table, lead.ref_id, { label: lead.name || lead['mobile'] || lead.email || lead.ref_id });
      err = error;
    }
    if (err) { toast({ title: "Delete failed", description: err.message, variant: "destructive" }); return; }
    setLeads(prev => prev.filter(l => !(l.source === lead.source && l.ref_id === lead.ref_id)));
    toast({ title: "🗑️ Deleted" });
  };

  const filtered = useMemo(() => leads.filter(l => {
    if (filter !== "all" && l.source !== filter) return false;
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (l.name + " " + l['mobile'] + " " + l.email + " " + l.city + " " + l.note).toLowerCase().includes(q);
    }
    return true;
  }), [leads, filter, statusFilter, search]);

  useEffect(() => { setPage(1); }, [filter, statusFilter, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const counts = useMemo(() => {
    const c: any = { all: leads.length };
    leads.forEach(l => { c[l.source] = (c[l.source] || 0) + 1; });
    return c;
  }, [leads]);

  const newCount = useMemo(() => leads.filter(l => l.status === "new").length, [leads]);

  const exportCSV = () => {
    if (!filtered.length) { toast({ title: "Nothing to export", variant: "destructive" }); return; }
    const headers = ["Source", "Status", "Name", "Mobile", "Email", "City", "Age", "Gender", "Diseases", "Note", "Created At"];
    const rows = filtered.map(l => [
      sourceMeta[l.source].label, l.status || "—", l.name, l['mobile'], l.email, l.city,
      l.age, l.gender, l.disease, l.note,
      l.created_at ? new Date(l.created_at).toLocaleString() : "",
    ]);
    const escape = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `all_leads_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="sticky top-0 z-30 bg-background -mx-3 sm:mx-0 px-3 sm:px-0 pt-2 pb-3 border-b border-border mb-3">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              All Leads ({filtered.length})
              {newCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-xs font-bold bg-red-600 text-white animate-pulse shadow">
                  {newCount} NEW
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">Unified view of every customer interaction across the site.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border bg-card border-border hover:bg-secondary"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
            <button onClick={exportCSV} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90"><Download className="h-3.5 w-3.5" /> Export CSV</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          {(["all", "signup", "signin", "consultation", "popup", "contact", "order", "newsletter"] as const).map(k => (
            <button key={k} onClick={() => setFilter(k as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filter === k ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:bg-secondary"}`}>
              {k === "all" ? "All" : sourceMeta[k as LeadSource].label} <span className="opacity-70">({counts[k] || 0})</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={() => setStatusFilter("all")}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition ${statusFilter === "all" ? "bg-foreground text-background border-foreground" : "bg-card border-border text-foreground hover:bg-secondary"}`}>
            All Status
          </button>
          {STATUS_OPTIONS.map(s => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition ${statusFilter === s.value ? "bg-foreground text-background border-foreground" : s.color}`}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, mobile, email, city..."
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-card text-sm" />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-2 py-3 font-medium text-muted-foreground w-10">#</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Source</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Status</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Name</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Mobile</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden md:table-cell">Email</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden lg:table-cell">City</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Age</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Gender</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Diseases</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden lg:table-cell">Note</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">When</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Action</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={13} className="text-center py-8 text-muted-foreground">Loading leads from all sources...</td></tr> :
              filtered.length === 0 ? <tr><td colSpan={13} className="text-center py-8 text-muted-foreground">No leads found</td></tr> :
              paginated.map((l, i) => {
                const m = sourceMeta[l.source];
                const statusMeta = STATUS_OPTIONS.find(s => s.value === l.status);
                const editable = l.source !== "newsletter";
                const serial = (currentPage - 1) * PAGE_SIZE + i + 1;
                return (
                  <tr key={l.source + "-" + l.ref_id + "-" + i} className={`border-t border-border hover:bg-muted/50 ${l.status === "new" ? "bg-red-50/40" : ""}`}>
                    <td className="px-2 py-2.5 text-xs font-semibold text-muted-foreground">{serial}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${m.color}`}>
                        <m.Icon className="h-3 w-3" /> {m.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {editable ? (
                        <select
                          value={l.status || "new"}
                          onChange={e => updateStatus(l, e.target.value as LeadStatus)}
                          className={`text-[11px] font-bold border rounded-full px-2 py-1 cursor-pointer ${statusMeta?.color || "bg-card border-border"}`}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      ) : <span className="text-[11px] text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-xs sm:text-sm">{l.name || "—"}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {l['mobile'] ? (
                        <a href={`tel:${l['mobile']}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="h-3 w-3" />{l['mobile']}</a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs hidden md:table-cell">{l.email || "—"}</td>
                    <td className="px-3 py-2.5 text-xs hidden lg:table-cell">{l.city || "—"}</td>
                    <td className="px-3 py-2.5 text-xs">{l.age || "—"}</td>
                    <td className="px-3 py-2.5 text-xs capitalize">{l.gender || "—"}</td>
                    <td className="px-3 py-2.5 text-xs truncate max-w-[180px]">{l.disease || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden lg:table-cell truncate max-w-[260px]">{l.note || "—"}</td>
                    <td className="px-3 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                      {l.created_at ? new Date(l.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => deleteLead(l)} title="Delete lead"
                        className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="flex items-center justify-between gap-3 p-3 border-t border-border bg-muted/30 text-xs">
            <span className="text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{(currentPage - 1) * PAGE_SIZE + 1}</span>–<span className="font-semibold text-foreground">{Math.min(currentPage * PAGE_SIZE, filtered.length)}</span> of <span className="font-semibold text-foreground">{filtered.length}</span>
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-border bg-card font-semibold disabled:opacity-40 hover:bg-secondary transition">← Prev</button>
              <span className="font-semibold text-foreground">Page {currentPage} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-border bg-card font-semibold disabled:opacity-40 hover:bg-secondary transition">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLeads;
