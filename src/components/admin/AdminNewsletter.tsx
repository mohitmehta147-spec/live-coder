import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Download, Mail } from "lucide-react";

const AdminNewsletter = () => {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAll = async () => { setLoading(true); const { data } = await (supabase as any).from("newsletter_subscribers").select("*").order("created_at", { ascending: false }); setSubs(data || []); setLoading(false); };
  useEffect(() => { fetchAll(); }, []);

  const del = async (id: string) => { if (!confirm("Remove subscriber?")) return; await (supabase as any).from("newsletter_subscribers").delete().eq("id", id); toast({ title: "✅ Removed" }); fetchAll(); };
  const toggle = async (id: string, is_active: boolean) => { await (supabase as any).from("newsletter_subscribers").update({ is_active: !is_active }).eq("id", id); fetchAll(); };

  const exportCSV = () => {
    const csv = "Email,Name,Source,Status,Date\n" + subs.map(s => `${s.email},${s.name || ""},${s.source || ""},${s.is_active ? "Active" : "Unsub"},${new Date(s.created_at).toLocaleString()}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `subscribers-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2"><Mail className="h-6 w-6" /> Newsletter Subscribers <span className="text-sm text-muted-foreground font-normal">({subs.length})</span></h2>
        <button onClick={exportCSV} disabled={!subs.length} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><Download className="h-4 w-4" /> Export CSV</button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-4 py-3">Email</th>
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Source</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Subscribed</th>
            <th className="text-left px-4 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
            subs.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No subscribers yet</td></tr> :
            subs.map(s => (
              <tr key={s.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-3 font-medium">{s.email}</td>
                <td className="px-4 py-3">{s.name || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{s.source || "website"}</td>
                <td className="px-4 py-3"><button onClick={() => toggle(s.id, s.is_active)} className={`text-xs px-2 py-1 rounded-full ${s.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{s.is_active ? "Active" : "Unsubscribed"}</button></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3"><button onClick={() => del(s.id)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4 text-destructive" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default AdminNewsletter;
