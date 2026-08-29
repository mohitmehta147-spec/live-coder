import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/imageCompress";
import { trashDelete } from "@/lib/trash";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Upload, X } from "lucide-react";

const AdminBanners = () => {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", subtitle: "", cta_text: "", cta_link: "", bg_color: "", is_active: true, image_url: "", image_url_mobile: "", mobile_height: "auto", section: "hero" });
  const fileRef = useRef<HTMLInputElement>(null);
  const mobileFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchBanners = async () => { const { data } = await supabase.from("banners").select("*").order("sort_order"); setBanners(data || []); setLoading(false); };
  useEffect(() => { fetchBanners(); }, []);

  const reset = () => { setForm({ title: "", subtitle: "", cta_text: "", cta_link: "", bg_color: "", is_active: true, image_url: "", image_url_mobile: "", mobile_height: "auto", section: "hero" }); setEditing(null); };

  const uploadTo = async (field: "image_url" | "image_url_mobile", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const prepared = await compressImage(file, 1920, 0.85);
    const fileName = `banner-${Date.now()}.${prepared.ext}`;
    const { error } = await supabase.storage.from("product-images").upload(fileName, prepared.blob, { contentType: prepared.contentType });
    if (!error) {
      const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
      setForm(f => ({ ...f, [field]: data.publicUrl }));
    } else { toast({ title: "Upload failed", variant: "destructive" }); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (mobileFileRef.current) mobileFileRef.current.value = "";
  };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => uploadTo("image_url", e);

  const save = async () => {
    const payload = { ...form, title: form.title || "Untitled", bg_color: form.bg_color || null, image_url: form.image_url || null, image_url_mobile: form.image_url_mobile || null, mobile_height: form.mobile_height || "auto" };
    if (editing) {
      const { error } = await supabase.from("banners").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "✅ Banner updated!" });
    } else {
      const { error } = await supabase.from("banners").insert(payload);
      if (error) { toast({ title: "Add failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "✅ Banner added!" });
    }
    reset(); fetchBanners();
  };

  const del = async (id: string) => {
    if (confirm("Delete?")) {
      const { error } = await trashDelete("banners", id);
      if (error) { toast({ title: "Delete failed", variant: "destructive" }); return; }
      toast({ title: "✅ Banner deleted" });
      fetchBanners();
    }
  };

  const sections = ["hero", "promo", "category", "footer", "popup"];

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Banners</h2>
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-4">{editing ? "✏️ Edit" : "➕ Add"} Banner</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Subtitle" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="CTA Text (e.g. Shop Now)" value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="CTA Link (e.g. /products)" value={form.cta_link} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <div className="flex gap-2">
            <input placeholder="BG Color (#hex)" value={form.bg_color} onChange={(e) => setForm({ ...form, bg_color: e.target.value })} className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            {form.bg_color && <div className="w-10 h-10 rounded-lg border border-border" style={{ backgroundColor: form.bg_color }} />}
          </div>
          <select value={form.mobile_height} onChange={(e) => setForm({ ...form, mobile_height: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
            <option value="auto">📱 Mobile height: Auto (image ratio)</option>
            <option value="square">📱 Mobile height: Square (1:1)</option>
            <option value="tall">📱 Mobile height: Tall (4:5)</option>
            <option value="portrait">📱 Mobile height: Portrait (3:4)</option>
            <option value="short">📱 Mobile height: Short (16:9)</option>
          </select>
          <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
            {sections.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        
        {/* Banner Image */}
        <div className="mt-3">
          <label className="text-sm font-medium text-foreground mb-1 block">🖥️ Desktop Banner Image — Exact size: <span className="text-primary font-bold">1920 × 600 px</span></label>
          <p className="text-xs text-muted-foreground mb-2">Hero slider ke liye exactly <strong>1920×600px</strong> (ratio 16:5) banayein. Doosre sections: Promo <strong>1200×400px</strong>, Category <strong>800×300px</strong>. Max 2MB, JPG/PNG/WebP. Upload par auto-compress hota hai.</p>
          <div className="flex items-center gap-3">
            {form.image_url ? (
              <div className="relative group w-32 h-16 rounded-lg border border-border overflow-hidden">
                <img loading="lazy" decoding="async" src={form.image_url} alt="Banner" className="w-full h-full object-cover" />
                <button onClick={() => setForm(f => ({ ...f, image_url: "" }))} className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-32 h-16 rounded-lg border-2 border-dashed border-border hover:border-primary flex items-center justify-center gap-1 text-muted-foreground hover:text-primary transition text-xs disabled:opacity-50">
                {uploading ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <><Upload className="h-4 w-4" />Upload</>}
              </button>
            )}
            <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleImageUpload} className="hidden" />
          </div>
        </div>

        {/* Mobile Banner Image */}
        <div className="mt-3">
          <label className="text-sm font-medium text-foreground mb-1 block">📱 Mobile Banner Image — Exact size: <span className="text-primary font-bold">1080 × 1350 px</span></label>
          <p className="text-xs text-muted-foreground mb-2">Phones par alag image dikhti hai. Exactly <strong>1080×1350px</strong> (ratio 4:5) banayein — mobile height <strong>Tall (4:5)</strong> ke saath perfect fit. Square chahiye to <strong>1080×1080px</strong> (1:1) bhi chalega. Khali chhodne par desktop image crop ho kar dikhegi.</p>
          <div className="flex items-center gap-3">
            {form.image_url_mobile ? (
              <div className="relative group w-20 h-24 rounded-lg border border-border overflow-hidden">
                <img loading="lazy" decoding="async" src={form.image_url_mobile} alt="Mobile banner" className="w-full h-full object-cover" />
                <button onClick={() => setForm(f => ({ ...f, image_url_mobile: "" }))} className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <button onClick={() => mobileFileRef.current?.click()} disabled={uploading}
                className="w-20 h-24 rounded-lg border-2 border-dashed border-border hover:border-primary flex items-center justify-center gap-1 text-muted-foreground hover:text-primary transition text-xs disabled:opacity-50">
                {uploading ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <><Upload className="h-4 w-4" />Upload</>}
              </button>
            )}
            <input ref={mobileFileRef} type="file" accept=".png,.jpg,.jpeg,.webp" onChange={(e) => uploadTo("image_url_mobile", e)} className="hidden" />
          </div>
        </div>

        {/* Ready-made banner sets */}
        <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-3">
          <p className="text-sm font-medium text-foreground mb-1">🎨 Ready-made Ayurvedic banner sets</p>
          <p className="text-xs text-muted-foreground mb-3">One click me desktop (1920×600) + mobile (1080×1350) dono set ho jaayenge. Mobile height <strong>Tall (4:5)</strong> rakhein aur CTA link <code>/products</code> dein.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: "1", label: "Herbs & Capsules (green)", d: "/banners/hero-ayurveda-1-desktop.jpg", m: "/banners/hero-ayurveda-1-mobile.jpg" },
              { key: "2", label: "Juices & Honey (cream)", d: "/banners/hero-ayurveda-2-desktop.jpg", m: "/banners/hero-ayurveda-2-mobile.jpg" },
            ].map(b => (
              <button key={b.key} type="button"
                onClick={() => setForm(f => ({ ...f, image_url: b.d, image_url_mobile: b.m, mobile_height: "tall", section: "hero", cta_link: f.cta_link || "/products" }))}
                className="text-left rounded-lg border border-border bg-card overflow-hidden hover:border-primary transition">
                <img src={b.d} alt={b.label} className="w-full h-20 object-cover" loading="lazy" />
                <span className="block px-3 py-2 text-xs font-medium text-foreground">{b.label} — Use this set</span>
              </button>
            ))}
          </div>
        </div>



        <div className="flex items-center gap-3 mt-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
        </div>

        <div className="flex gap-2 mt-3">
          <button onClick={save} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition">{editing ? "Update" : "Add"} Banner</button>
          {editing && <button onClick={reset} className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm">Cancel</button>}
        </div>
      </div>

      {/* Banner List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Image</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Section</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Active</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
            banners.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No banners</td></tr> :
            banners.map((b) => (
              <tr key={b.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-3">
                  {b.image_url ? <img loading="lazy" decoding="async" src={b.image_url} alt="" className="w-20 h-10 rounded object-cover" /> : <div className="w-20 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">No image</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{b.title}</div>
                  {b.subtitle && <div className="text-xs text-muted-foreground">{b.subtitle}</div>}
                </td>
                <td className="px-4 py-3"><span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">{b.section || 'hero'}</span></td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${b.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{b.is_active ? "Yes" : "No"}</span></td>
                <td className="px-4 py-3"><div className="flex gap-1">
                  <button onClick={() => { setEditing(b); setForm({ title: b.title, subtitle: b.subtitle || "", cta_text: b.cta_text || "", cta_link: b.cta_link || "", bg_color: b.bg_color || "", is_active: b.is_active, image_url: b.image_url || "", image_url_mobile: b.image_url_mobile || "", mobile_height: b.mobile_height || "auto", section: b.section || "hero" }); }} className="p-1.5 hover:bg-secondary rounded"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                  <button onClick={() => del(b.id)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminBanners;
