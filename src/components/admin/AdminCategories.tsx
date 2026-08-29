import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { trashDelete } from "@/lib/trash";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/imageCompress";
import { Pencil, Trash2, GripVertical, Upload, X } from "lucide-react";

type Category = {
  id: string; name: string; name_hi: string | null; slug: string;
  description: string | null;
  icon: string | null; image_url: string | null;
  is_active: boolean | null; parent_id: string | null; sort_order: number | null;
  show_in_navbar?: boolean | null; show_in_concern?: boolean | null;
  show_in_shop?: boolean | null; show_in_filters?: boolean | null; is_featured?: boolean | null;
  discount_percentage?: number | null;
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
};

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};

const EMPTY = {
  name: "", name_hi: "", slug: "", description: "", icon: "", image_url: "",
  is_active: true, parent_id: "",
  show_in_navbar: true, show_in_concern: true, show_in_shop: true, show_in_filters: true, is_featured: false,
  discount_percentage: "0", sale_starts_at: "", sale_ends_at: "",
};

const VISIBILITY: { key: keyof typeof EMPTY; label: string; hint: string }[] = [
  { key: "show_in_navbar", label: "Show in Navbar", hint: "Top menu (desktop + mobile)" },
  { key: "show_in_concern", label: "Show in Shop By Concern", hint: "Homepage concern pills" },
  { key: "show_in_shop", label: "Show in Shop", hint: "Shop / products listing" },
  { key: "show_in_filters", label: "Show in Product Filters", hint: "Sidebar filters" },
  { key: "is_featured", label: "Featured Category", hint: "Highlighted placements" },
];

const AdminCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Move ${selected.size} categories to Trash?`)) return;
    const ids = Array.from(selected);
    let failed = 0;
    for (const id of ids) { const { error } = await trashDelete("categories", id); if (error) failed++; }
    if (failed) toast({ title: `Moved ${ids.length - failed}, ${failed} failed`, variant: "destructive" });
    else toast({ title: `🗑️ Moved ${ids.length} categories to Trash` });
    setSelected(new Set()); fetchCats();
  };
  const toggleSel = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const fetchCats = async () => {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setCategories((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchCats(); }, []);

  const reset = () => { setForm({ ...EMPTY }); setEditing(null); };

  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const prepared = await compressImage(file);
      const fileName = `category-${Date.now()}-${Math.random().toString(36).slice(2)}.${prepared.ext}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, prepared.blob, { contentType: prepared.contentType });
      if (error) { toast({ title: `Upload failed: ${error.message}`, variant: "destructive" }); return; }
      const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
      setForm(prev => ({ ...prev, image_url: data.publicUrl }));
      toast({ title: "✅ Image uploaded" });
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "Category name is required", variant: "destructive" });
      return;
    }
    const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const payload: any = {
      name: form.name.trim(), name_hi: form.name_hi.trim() || null, slug,
      description: form.description.trim() || null,
      icon: form.icon || null, image_url: form.image_url || null,
      is_active: form.is_active,
      parent_id: form.parent_id || null,
      show_in_navbar: form.show_in_navbar,
      show_in_concern: form.show_in_concern,
      show_in_shop: form.show_in_shop,
      show_in_filters: form.show_in_filters,
      is_featured: form.is_featured,
      discount_percentage: parseFloat(form.discount_percentage) || 0,
      sale_starts_at: form.sale_starts_at ? new Date(form.sale_starts_at).toISOString() : null,
      sale_ends_at: form.sale_ends_at ? new Date(form.sale_ends_at).toISOString() : null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("categories").update(payload).eq("id", editing.id));
    } else {
      payload.sort_order = (categories.reduce((m, c) => Math.max(m, c.sort_order || 0), 0) || 0) + 1;
      ({ error } = await supabase.from("categories").insert(payload));
    }
    if (error) {
      const msg = error.message?.includes("duplicate") || error.message?.includes("unique")
        ? `A category with slug "${slug}" already exists. Try a different slug.`
        : error.message;
      toast({ title: editing ? "Update failed" : "Add failed", description: msg, variant: "destructive" });
    } else {
      toast({ title: editing ? "✅ Category updated!" : "✅ Category added!" });
      reset(); fetchCats();
    }
  };

  const quickToggle = async (c: Category, field: string, value: boolean) => {
    setCategories(prev => prev.map(x => x.id === c.id ? { ...x, [field]: value } as Category : x));
    const { error } = await supabase.from("categories").update({ [field]: value } as any).eq("id", c.id);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); fetchCats(); }
  };

  const del = async (id: string, name: string) => {
    if (confirm(`Move category "${name}" to Trash? Restore within 30 days.`)) {
      const { error } = await trashDelete("categories", id, { label: name });
      if (!error) { toast({ title: "🗑️ Moved to Trash" }); fetchCats(); }
      else toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
  };

  const parents = categories.filter(c => !c.parent_id);
  const getChildren = (pid: string) => categories.filter(c => c.parent_id === pid);
  const displayList: (Category & { depth: number })[] = [];
  parents.forEach(p => {
    displayList.push({ ...p, depth: 0 });
    getChildren(p.id).forEach(c => {
      displayList.push({ ...c, depth: 1 });
      getChildren(c.id).forEach(g => displayList.push({ ...g, depth: 2 }));
    });
  });

  /** Drag & drop reorder within the same level (same parent). */
  const onDrop = async (targetId: string) => {
    const source = categories.find(c => c.id === dragId);
    const target = categories.find(c => c.id === targetId);
    setDragId(null);
    if (!source || !target || source.id === target.id) return;
    if ((source.parent_id || null) !== (target.parent_id || null)) {
      toast({ title: "Reorder within the same level only", variant: "destructive" });
      return;
    }
    const siblings = categories.filter(c => (c.parent_id || null) === (source.parent_id || null));
    const rest = siblings.filter(c => c.id !== source.id);
    const idx = rest.findIndex(c => c.id === target.id);
    rest.splice(idx, 0, source);
    const updates = rest.map((c, i) => ({ id: c.id, sort_order: i + 1 }));
    setCategories(prev => prev.map(c => {
      const u = updates.find(x => x.id === c.id);
      return u ? { ...c, sort_order: u.sort_order } : c;
    }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    for (const u of updates) await supabase.from("categories").update({ sort_order: u.sort_order }).eq("id", u.id);
    toast({ title: "✅ Order saved" });
    fetchCats();
  };

  const Flag = ({ on }: { on: boolean }) => (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${on ? "bg-primary" : "bg-muted-foreground/30"}`} />
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-2">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Categories ({categories.length})</h2>
          <p className="text-xs text-muted-foreground mt-0.5">This panel controls the navbar, Shop By Concern, shop and filters everywhere on the site.</p>
        </div>
        {selected.size > 0 && (
          <button onClick={bulkDelete} className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90">
            <Trash2 className="h-4 w-4" /> Delete ({selected.size})
          </button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-4">{editing ? "Edit" : "Add"} Category</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Hindi Name" value={form.name_hi} onChange={(e) => setForm({ ...form, name_hi: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Slug (URL)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Icon (emoji)" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
            <option value="">📁 MAIN CATEGORY (no parent)</option>
            {categories.filter(c => c.id !== editing?.id).map(p => (
              <option key={p.id} value={p.id}>{p.parent_id ? "↳ SUB: " : "📁 MAIN: "}{p.name}</option>
            ))}
          </select>
          <input placeholder="Discount % (e.g. 10)" value={form.discount_percentage} onChange={(e) => setForm({ ...form, discount_percentage: e.target.value })} type="number" min="0" max="100"
            className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
            className="md:col-span-3 px-3 py-2 border border-border rounded-lg text-sm bg-background" />
        </div>

        {/* Image */}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {form.image_url ? (
            <div className="relative">
              <img loading="lazy" decoding="async" src={form.image_url} alt="" className="h-20 w-20 object-cover rounded-lg border border-border bg-muted" />
              <button onClick={() => setForm({ ...form, image_url: "" })} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5" title="Remove image">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <label className="h-20 w-20 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary text-[10px] text-muted-foreground">
              <Upload className="h-4 w-4 mb-1" /> {uploading ? "…" : "Image"}
              <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={e => { uploadImage(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          )}
          <input placeholder="…or paste image URL" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })}
            className="flex-1 min-w-[220px] px-3 py-2 border border-border rounded-lg text-sm bg-background" />
        </div>

        {/* Visibility controls */}
        <div className="mt-4 bg-muted/40 rounded-xl p-4 border border-border">
          <h4 className="text-sm font-semibold text-foreground mb-3">👁️ Where should this category appear?</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <label className="flex items-start gap-2 text-sm bg-card rounded-lg px-3 py-2 border border-border">
              <input type="checkbox" className="mt-0.5" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <span><b>Active</b><br /><span className="text-[11px] text-muted-foreground">Master switch (off = hidden everywhere)</span></span>
            </label>
            {VISIBILITY.map(v => (
              <label key={String(v.key)} className="flex items-start gap-2 text-sm bg-card rounded-lg px-3 py-2 border border-border">
                <input type="checkbox" className="mt-0.5" checked={Boolean((form as any)[v.key])} onChange={(e) => setForm({ ...form, [v.key]: e.target.checked } as any)} />
                <span><b>{v.label}</b><br /><span className="text-[11px] text-muted-foreground">{v.hint}</span></span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-border">
          <label className="text-xs text-muted-foreground">Sale Starts At
            <input type="datetime-local" value={form.sale_starts_at} onChange={(e) => setForm({ ...form, sale_starts_at: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </label>
          <label className="text-xs text-muted-foreground">Sale Ends At
            <input type="datetime-local" value={form.sale_ends_at} onChange={(e) => setForm({ ...form, sale_ends_at: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </label>
          <p className="md:col-span-2 text-xs text-muted-foreground">Discount applies to all products in this category between Start and End. Leave dates blank for an always-on discount.</p>
        </div>

        <div className="flex gap-2 mt-3">
          <button onClick={save} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition">{editing ? "Update" : "Add"}</button>
          {editing && <button onClick={reset} className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm">Cancel</button>}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/60 text-xs text-muted-foreground border-b border-border">
          Drag <GripVertical className="h-3 w-3 inline" /> to reorder (within the same level). The order here is exactly what customers see.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr>
              <th className="px-2 py-3 w-8">
                <input type="checkbox" checked={selected.size === displayList.length && displayList.length > 0}
                  onChange={e => setSelected(e.target.checked ? new Set(displayList.map(c => c.id)) : new Set())} />
              </th>
              <th className="w-8" />
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Slug</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Navbar</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Concern</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Shop</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Filters</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground">Featured</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
              displayList.length === 0 ? <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">No categories</td></tr> :
              displayList.map((c) => (
                <tr key={c.id}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(c.id)}
                  className={`border-t border-border hover:bg-muted/50 ${c.depth > 0 ? 'bg-muted/20' : ''} ${selected.has(c.id) ? 'bg-primary/5' : ''} ${dragId === c.id ? 'opacity-50' : ''}`}>
                  <td className="px-2 py-3 w-8"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSel(c.id)} /></td>
                  <td className="w-8 text-muted-foreground cursor-grab"><GripVertical className="h-4 w-4" /></td>
                  <td className="px-4 py-3 font-medium">
                    <span style={{ paddingLeft: c.depth * 20 }} className="flex items-center gap-2">
                      {c.image_url && <img loading="lazy" decoding="async" src={c.image_url} alt="" className="h-7 w-7 rounded object-cover border border-border" />}
                      <span className={c.depth > 0 ? "text-muted-foreground" : ""}>
                        {c.depth === 0 ? "📁 " : "↳ "}{c.icon} {c.name}
                        {c.is_active === false && <span className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded">inactive</span>}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.slug}</td>
                  {(["show_in_navbar", "show_in_concern", "show_in_shop", "show_in_filters", "is_featured"] as const).map(field => {
                    const raw = (c as any)[field];
                    const on = field === "is_featured" ? Boolean(raw) : raw !== false && raw !== 0;
                    return (
                      <td key={field} className="px-3 py-3">
                        <button onClick={() => quickToggle(c, field, !on)} title={`Toggle ${field}`} className="flex items-center gap-1.5">
                          <Flag on={on} />
                        </button>
                      </td>
                    );
                  })}

                  <td className="px-4 py-3"><div className="flex gap-1">
                    <button onClick={() => {
                      setEditing(c);
                      setForm({
                        name: c.name, name_hi: c.name_hi || "", slug: c.slug,
                        description: c.description || "", icon: c.icon || "", image_url: c.image_url || "",
                        is_active: c.is_active !== false, parent_id: c.parent_id || "",
                        show_in_navbar: (c as any).show_in_navbar !== false,
                        show_in_concern: (c as any).show_in_concern !== false,
                        show_in_shop: (c as any).show_in_shop !== false,
                        show_in_filters: (c as any).show_in_filters !== false,
                        is_featured: Boolean((c as any).is_featured),
                        discount_percentage: String((c as any).discount_percentage || 0),
                        sale_starts_at: toLocalInput((c as any).sale_starts_at),
                        sale_ends_at: toLocalInput((c as any).sale_ends_at),
                      });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }} className="p-1.5 hover:bg-secondary rounded"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                    <button onClick={() => del(c.id, c.name)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminCategories;
