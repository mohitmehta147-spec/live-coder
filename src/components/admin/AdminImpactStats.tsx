import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { trashDelete } from "@/lib/trash";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2 } from "lucide-react";

const AdminImpactStats = () => {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ icon: "📊", value: "", label: "", label_hi: "", sort_order: 0, is_active: true });
  const { toast } = useToast();

  const fetchAll = async () => { const { data } = await supabase.from("impact_stats").select("*").order("sort_order"); setStats(data || []); setLoading(false); };
  useEffect(() => { fetchAll(); }, []);

  const reset = () => { setForm({ icon: "📊", value: "", label: "", label_hi: "", sort_order: 0, is_active: true }); setEditing(null); };

  const save = async () => {
    if (!form.value.trim() || !form.label.trim()) { toast({ title: "Value & Label required", variant: "destructive" }); return; }
    const payload = { ...form, label_hi: form.label_hi || null };
    if (editing) {
      await supabase.from("impact_stats").update(payload).eq("id", editing.id);
      toast({ title: "✅ Updated!" });
    } else {
      await supabase.from("impact_stats").insert(payload);
      toast({ title: "✅ Added!" });
    }
    reset(); fetchAll();
  };

  const del = async (id: string) => {
    if (confirm("Delete?")) { await trashDelete("impact_stats", id); toast({ title: "✅ Deleted" }); fetchAll(); }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">📊 Impact Stats</h2>
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-4">{editing ? "✏️ Edit" : "➕ Add"} Stat</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Icon (emoji) e.g. 👥" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Value * (e.g. 10 Lakh+)" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Label * (English)" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Label (Hindi)" value={form.label_hi} onChange={e => setForm({ ...form, label_hi: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input type="number" placeholder="Sort Order" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={save} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition">{editing ? "Update" : "Add"}</button>
          {editing && <button onClick={reset} className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm">Cancel</button>}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Icon</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Value</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Label</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Active</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
            stats.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No stats</td></tr> :
            stats.map(s => (
              <tr key={s.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-3 text-xl">{s.icon}</td>
                <td className="px-4 py-3 font-bold text-primary">{s.value}</td>
                <td className="px-4 py-3"><div>{s.label}</div>{s.label_hi && <div className="text-xs text-muted-foreground">{s.label_hi}</div>}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${s.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{s.is_active ? "Yes" : "No"}</span></td>
                <td className="px-4 py-3"><div className="flex gap-1">
                  <button onClick={() => { setEditing(s); setForm({ icon: s.icon || "📊", value: s.value, label: s.label, label_hi: s.label_hi || "", sort_order: s.sort_order || 0, is_active: s.is_active }); }} className="p-1.5 hover:bg-secondary rounded"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                  <button onClick={() => del(s.id)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminImpactStats;
