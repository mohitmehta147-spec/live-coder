import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { trashDelete } from "@/lib/trash";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Upload, X, Star } from "lucide-react";

const AdminTestimonials = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", location: "", rating: 5, content: "", content_hi: "", image_url: "", sort_order: 0, is_active: true });
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchAll = async () => { const { data } = await (supabase as any).from("testimonials").select("*").order("sort_order"); setItems(data || []); setLoading(false); };
  useEffect(() => { fetchAll(); }, []);
  const reset = () => { setForm({ name: "", role: "", location: "", rating: 5, content: "", content_hi: "", image_url: "", sort_order: 0, is_active: true }); setEditing(null); };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fileName = `testimonial-${Date.now()}.${file.name.split('.').pop()?.toLowerCase()}`;
    const { error } = await supabase.storage.from("product-images").upload(fileName, file, { contentType: file.type });
    if (!error) { const { data } = supabase.storage.from("product-images").getPublicUrl(fileName); setForm(f => ({ ...f, image_url: data.publicUrl })); }
    else toast({ title: "Upload failed", variant: "destructive" });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const save = async () => {
    if (!form.name.trim() || !form.content.trim()) { toast({ title: "Name & Content required", variant: "destructive" }); return; }
    const payload = { ...form, image_url: form.image_url || null };
    if (editing) { await (supabase as any).from("testimonials").update(payload).eq("id", editing.id); toast({ title: "✅ Updated!" }); }
    else { await (supabase as any).from("testimonials").insert(payload); toast({ title: "✅ Added!" }); }
    reset(); fetchAll();
  };
  const del = async (id: string) => { if (confirm("Delete?")) { await trashDelete("testimonials", id); toast({ title: "✅ Deleted" }); fetchAll(); } };

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">💬 Testimonials</h2>
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-4">{editing ? "✏️ Edit" : "➕ Add"} Testimonial</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Role / Designation" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Location (City)" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input type="number" min={1} max={5} placeholder="Rating" value={form.rating} onChange={e => setForm({ ...form, rating: Number(e.target.value) })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <textarea placeholder="Content (English) *" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="md:col-span-2 px-3 py-2 border border-border rounded-lg text-sm bg-background" rows={3} />
          <textarea placeholder="Content (Hindi)" value={form.content_hi} onChange={e => setForm({ ...form, content_hi: e.target.value })} className="md:col-span-2 px-3 py-2 border border-border rounded-lg text-sm bg-background" rows={3} />
          <input type="number" placeholder="Sort Order" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
        </div>
        <div className="mt-3">
          <label className="text-sm font-medium mb-2 block">Photo</label>
          <div className="flex items-center gap-3">
            {form.image_url ? (
              <div className="relative w-16 h-16 rounded-full border border-border overflow-hidden">
                <img loading="lazy" decoding="async" src={form.image_url} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setForm(f => ({ ...f, image_url: "" }))} className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-16 h-16 rounded-full border-2 border-dashed border-border hover:border-primary flex items-center justify-center text-muted-foreground disabled:opacity-50">
                {uploading ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload className="h-5 w-5" />}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </div>
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
            <th className="text-left px-4 py-3">Photo</th><th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Rating</th><th className="text-left px-4 py-3">Content</th>
            <th className="text-left px-4 py-3">Active</th><th className="text-left px-4 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
            items.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No testimonials yet</td></tr> :
            items.map(t => (
              <tr key={t.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-3">{t.image_url ? <img loading="lazy" decoding="async" src={t.image_url} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">{t.name?.[0]}</div>}</td>
                <td className="px-4 py-3 font-medium">{t.name}<p className="text-xs text-muted-foreground">{t.location}</p></td>
                <td className="px-4 py-3"><div className="flex">{Array.from({length:5}).map((_,i)=><Star key={i} className={`h-3 w-3 ${i<t.rating?"fill-yellow-400 text-yellow-400":"text-border"}`}/>)}</div></td>
                <td className="px-4 py-3 max-w-xs"><p className="text-xs line-clamp-2">{t.content}</p></td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${t.is_active?"bg-primary/10 text-primary":"bg-muted text-muted-foreground"}`}>{t.is_active?"Yes":"No"}</span></td>
                <td className="px-4 py-3"><div className="flex gap-1">
                  <button onClick={() => { setEditing(t); setForm({ name: t.name, role: t.role||"", location: t.location||"", rating: t.rating||5, content: t.content||"", content_hi: t.content_hi||"", image_url: t.image_url||"", sort_order: t.sort_order||0, is_active: t.is_active }); }} className="p-1.5 hover:bg-secondary rounded"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                  <button onClick={() => del(t.id)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default AdminTestimonials;
