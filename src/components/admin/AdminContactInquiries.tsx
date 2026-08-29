import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { trashDelete } from "@/lib/trash";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, Trash2, Eye } from "lucide-react";

const AdminContactInquiries = () => {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const { toast } = useToast();

  const fetchAll = async () => {
    const query = supabase.from("contact_inquiries").select("*").order("created_at", { ascending: false });
    if (filter !== "all") query.eq("status", filter);
    const { data } = await query;
    setInquiries(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("contact_inquiries").update({ status }).eq("id", id);
    toast({ title: "✅ Status updated" });
    fetchAll();
    if (selected?.id === id) setSelected((s: any) => ({ ...s, status }));
  };

  const del = async (id: string) => {
    if (confirm("Delete this inquiry?")) {
      await trashDelete("contact_inquiries", id);
      toast({ title: "✅ Deleted" });
      if (selected?.id === id) setSelected(null);
      fetchAll();
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">📩 Contact Inquiries</h2>

      <div className="flex gap-2 mb-4">
        {["all", "new", "replied", "closed"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${filter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
            {s}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="bg-card rounded-xl border border-border p-5 mb-4">
          <button onClick={() => setSelected(null)} className="text-sm text-primary hover:underline mb-3 block">← Back to list</button>
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-foreground text-lg">{selected.name}</h3>
                <p className="text-xs text-muted-foreground">{new Date(selected.created_at).toLocaleString('en-IN')}</p>
              </div>
              <select value={selected.status} onChange={e => updateStatus(selected.id, e.target.value)}
                className="text-xs px-2 py-1 border border-border rounded bg-background">
                <option value="new">New</option>
                <option value="replied">Replied</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            {selected.email && <p className="text-sm flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{selected.email}</p>}
            {selected['phone'] && <p className="text-sm flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{selected['phone']}</p>}
            {selected.subject && <p className="text-sm"><span className="font-medium">Subject:</span> {selected.subject}</p>}
            <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">{selected.message}</div>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground w-10">#</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Subject</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
              inquiries.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No inquiries</td></tr> :
              inquiries.map((inq, idx) => (
                <tr key={inq.id} className="border-t border-border hover:bg-muted/50">
                  <td className="px-3 py-3 text-xs font-semibold text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{inq.name}</p>
                    <p className="text-xs text-muted-foreground">{inq.email || inq['phone'] || ""}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{inq.subject || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      inq.status === "new" ? "bg-yellow-100 text-yellow-800" :
                      inq.status === "replied" ? "bg-blue-100 text-blue-800" :
                      "bg-green-100 text-green-800"
                    }`}>{inq.status}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                    {new Date(inq.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setSelected(inq)} className="p-1.5 hover:bg-secondary rounded"><Eye className="h-4 w-4 text-muted-foreground" /></button>
                      <button onClick={() => del(inq.id)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminContactInquiries;
