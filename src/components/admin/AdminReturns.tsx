import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Filter, X } from "lucide-react";

const AdminReturns = () => {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await supabase.from("returns" as any).select("*").order("created_at", { ascending: false });
        setReturns((data as any[]) || []);
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = returns.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return r.customer_name?.toLowerCase().includes(q) || r.customer_phone?.includes(q) || r.order_number?.toLowerCase().includes(q);
    }
    return true;
  });

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("returns" as any).update({ status }).eq("id", id);
      if (error) throw error;
      setReturns(returns.map(r => r.id === id ? { ...r, status } : r));
      toast({ title: "✅ Status updated to " + status });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  };

  const updateNotes = async (id: string, admin_notes: string) => {
    try {
      const { error } = await supabase.from("returns" as any).update({ admin_notes }).eq("id", id);
      if (error) throw error;
      setReturns(returns.map(r => r.id === id ? { ...r, admin_notes } : r));
    } catch { /* ignore */ }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "approved": return "bg-green-100 text-green-700";
      case "rejected": return "bg-red-100 text-red-700";
      case "completed": return "bg-blue-100 text-blue-700";
      default: return "bg-yellow-100 text-yellow-700";
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Returns & Exchanges ({filtered.length})</h2>
        <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${showFilters ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground hover:bg-secondary'}`}>
          <Filter className="h-3.5 w-3.5" /> Filters
        </button>
      </div>

      {showFilters && (
        <div className="bg-card rounded-xl border border-border p-3 mb-4 flex flex-wrap gap-2 items-center">
          <input placeholder="Search name, phone, order..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 border border-border rounded-lg text-xs bg-background flex-1 min-w-[150px]" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>
          {(filterStatus !== "all" || searchQuery) && (
            <button onClick={() => { setFilterStatus("all"); setSearchQuery(""); }} className="text-xs text-destructive hover:underline flex items-center gap-1">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Order #</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Customer</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden sm:table-cell">Phone</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Type</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden md:table-cell">Product</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden lg:table-cell">Reason</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden md:table-cell">Admin Notes</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Status</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
            filtered.length === 0 ? <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No return requests found</td></tr> :
            filtered.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-3 py-3 text-xs font-mono">{r.order_number || "-"}</td>
                <td className="px-3 py-3 font-medium text-xs sm:text-sm">{r.customer_name}</td>
                <td className="px-3 py-3 text-xs hidden sm:table-cell">{r.customer_phone}</td>
                <td className="px-3 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.return_type === "exchange" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                    {r.return_type === "exchange" ? "🔄 Exchange" : "↩️ Return"}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs hidden md:table-cell max-w-[150px] truncate">{r.product_details || "-"}</td>
                <td className="px-3 py-3 text-xs hidden lg:table-cell max-w-[200px] truncate">{r.reason}</td>
                <td className="px-3 py-3 text-xs hidden lg:table-cell">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-3 hidden md:table-cell">
                  <input
                    value={r.admin_notes || ""}
                    onChange={e => setReturns(returns.map(x => x.id === r.id ? { ...x, admin_notes: e.target.value } : x))}
                    onBlur={e => updateNotes(r.id, e.target.value)}
                    placeholder="Add notes..."
                    className="text-[11px] px-2 py-1 border border-border rounded bg-background w-full max-w-[150px]"
                  />
                </td>
                <td className="px-3 py-3">
                  <select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)}
                    className={`text-[11px] px-2 py-1 border border-border rounded ${statusColor(r.status)}`}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="completed">Completed</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminReturns;
