import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { trashDelete } from "@/lib/trash";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Upload, X } from "lucide-react";

const AdminMediaLogos = () => {
  const [logos, setLogos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: "", image_url: "", link: "", sort_order: 0, is_active: true });
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchAll = async () => { const { data } = await supabase.from("media_logos").select("*").order("sort_order"); setLogos(data || []); setLoading(false); };
  useEffect(() => { fetchAll(); }, []);

  const reset = () => { setForm({ name: "", image_url: "", link: "", sort_order: 0, is_active: true }); setEditing(null); };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fileName = `media-${Date.now()}.${file.name.split('.').pop()?.toLowerCase()}`;
    const { error } = await supabase.storage.from("product-images").upload(fileName, file, { contentType: file.type });
    if (!error) {
      const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
      setForm(f => ({ ...f, image_url: data.publicUrl }));
    } else toast({ title: "Upload failed", variant: "destructive" });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    const payload = { ...form, image_url: form.image_url || null, link: form.link || null };
    if (editing) {
      await supabase.from("media_logos").update(payload).eq("id", editing.id);
      toast({ title: "✅ Updated!" });
    } else {
      await supabase.from("media_logos").insert(payload);
      toast({ title: "✅ Added!" });
    }
    reset(); fetchAll();
  };

  const del = async (id: string) => {
    if (confirm("Delete?")) { await trashDelete("media_logos", id); toast({ title: "✅ Deleted" }); fetchAll(); }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">📰 Media Logos</h2>
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-4">{editing ? "✏️ Edit" : "➕ Add"} Logo</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Link (optional)" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input type="number" placeholder="Sort Order" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
        </div>
        <div className="mt-3">
          <label className="text-sm font-medium text-foreground mb-2 block">Logo Image</label>
          <div className="flex items-center gap-3">
            {form.image_url ? (
              <div className="relative group w-24 h-12 rounded-lg border border-border overflow-hidden bg-background">
                <img loading="lazy" decoding="async" src={form.image_url} alt="" className="w-full h-full object-contain" />
                <button onClick={() => setForm(f => ({ ...f, image_url: "" }))} className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-24 h-12 rounded-lg border-2 border-dashed border-border hover:border-primary flex items-center justify-center gap-1 text-muted-foreground hover:text-primary transition text-xs disabled:opacity-50">
                {uploading ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <><Upload className="h-4 w-4" />Upload</>}
              </button>
            )}
            <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={handleUpload} className="hidden" />
          </div>
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
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Logo</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Active</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
            logos.length === 0 ? <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No logos</td></tr> :
            logos.map(l => (
              <tr key={l.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-3">{l.image_url ? <img loading="lazy" decoding="async" src={l.image_url} alt="" className="w-16 h-8 object-contain" /> : <span className="text-xs text-muted-foreground">No image</span>}</td>
                <td className="px-4 py-3 font-medium">{l.name}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${l.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{l.is_active ? "Yes" : "No"}</span></td>
                <td className="px-4 py-3"><div className="flex gap-1">
                  <button onClick={() => { setEditing(l); setForm({ name: l.name, image_url: l.image_url || "", link: l.link || "", sort_order: l.sort_order || 0, is_active: l.is_active }); }} className="p-1.5 hover:bg-secondary rounded"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                  <button onClick={() => del(l.id)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminMediaLogos;
