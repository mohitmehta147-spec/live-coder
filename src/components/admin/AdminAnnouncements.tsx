import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2 } from "lucide-react";
import { trashDelete } from "@/lib/trash";

const AdminAnnouncements = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ message: "", message_hi: "", link: "", bg_color: "#0F172A", text_color: "#FFFFFF", sort_order: 0, is_active: true, starts_at: "", ends_at: "" });
  const { toast } = useToast();

  const fetchAll = async () => { const { data } = await (supabase as any).from("announcements").select("*").order("sort_order"); setItems(data || []); setLoading(false); };
  useEffect(() => { fetchAll(); }, []);
  const reset = () => { setForm({ message: "", message_hi: "", link: "", bg_color: "#0F172A", text_color: "#FFFFFF", sort_order: 0, is_active: true, starts_at: "", ends_at: "" }); setEditing(null); };

  const save = async () => {
    if (!form.message.trim()) { toast({ title: "Message required", variant: "destructive" }); return; }
    const payload: any = { ...form, link: form.link || null, starts_at: form.starts_at || null, ends_at: form.ends_at || null };
    if (editing) { await (supabase as any).from("announcements").update(payload).eq("id", editing.id); toast({ title: "✅ Updated!" }); }
    else { await (supabase as any).from("announcements").insert(payload); toast({ title: "✅ Added!" }); }
    reset(); fetchAll();
  };
  const del = async (id: string) => { if (confirm("Move to Trash?")) { await trashDelete("announcements", id); toast({ title: "🗑️ Moved to Trash" }); fetchAll(); } };

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">📢 Announcement Bar</h2>
      <p className="text-sm text-muted-foreground mb-4">Top of website par scroll hone wala message. Multiple active hone par rotate honge.</p>

      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h3 className="font-semibold mb-4">{editing ? "✏️ Edit" : "➕ Add"} Announcement</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Message (English) *" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="md:col-span-2 px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Message (Hindi)" value={form.message_hi} onChange={e => setForm({ ...form, message_hi: e.target.value })} className="md:col-span-2 px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Link (optional)" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input type="number" placeholder="Sort Order" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <label className="flex items-center gap-2 text-sm">BG Color <input type="color" value={form.bg_color} onChange={e => setForm({ ...form, bg_color: e.target.value })} className="h-9 w-16 border border-border rounded" /></label>
          <label className="flex items-center gap-2 text-sm">Text Color <input type="color" value={form.text_color} onChange={e => setForm({ ...form, text_color: e.target.value })} className="h-9 w-16 border border-border rounded" /></label>
          <label className="text-xs text-muted-foreground">Starts at<input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background mt-1" /></label>
          <label className="text-xs text-muted-foreground">Ends at<input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background mt-1" /></label>
        </div>
        <div className="mt-3 p-3 rounded-lg text-center text-sm font-medium" style={{ background: form.bg_color, color: form.text_color }}>
          Preview: {form.message || "Your announcement will appear here"}
        </div>
        <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
        <div className="flex gap-2 mt-3">
          <button onClick={save} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">{editing ? "Update" : "Add"}</button>
          {editing && <button onClick={reset} className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm">Cancel</button>}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-4 py-3">Message</th><th className="text-left px-4 py-3">Colors</th>
            <th className="text-left px-4 py-3">Active</th><th className="text-left px-4 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
            items.length === 0 ? <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No announcements</td></tr> :
            items.map(a => (
              <tr key={a.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-3"><p className="font-medium">{a.message}</p>{a.link && <a href={a.link} className="text-xs text-primary">{a.link}</a>}</td>
                <td className="px-4 py-3"><div className="flex gap-1"><span className="w-6 h-6 rounded border border-border" style={{ background: a.bg_color }} /><span className="w-6 h-6 rounded border border-border" style={{ background: a.text_color }} /></div></td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${a.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{a.is_active ? "Yes" : "No"}</span></td>
                <td className="px-4 py-3"><div className="flex gap-1">
                  <button onClick={() => { setEditing(a); setForm({ message: a.message, message_hi: a.message_hi||"", link: a.link||"", bg_color: a.bg_color||"#0F172A", text_color: a.text_color||"#FFFFFF", sort_order: a.sort_order||0, is_active: a.is_active, starts_at: a.starts_at ? a.starts_at.slice(0,16) : "", ends_at: a.ends_at ? a.ends_at.slice(0,16) : "" }); }} className="p-1.5 hover:bg-secondary rounded"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(a.id)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default AdminAnnouncements;
