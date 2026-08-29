import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { trashDelete } from "@/lib/trash";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Trash2, Star, Pencil, Package, Upload, Plus } from "lucide-react";

const toLocalInput = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const emptyDraft = (productId = "") => ({
  id: null as string | null,
  product_id: productId,
  user_name: "",
  rating: 5,
  title: "",
  comment: "",
  images: [] as string[],
  is_verified_purchase: true,
  status: "approved",
  created_at: new Date().toISOString(),
});

const AdminReviews = () => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: rev, error }, { data: prods }] = await Promise.all([
      (supabase as any).from("product_reviews").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("products").select("id,name").order("name"),
    ]);
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    const rows = rev || [];
    const prodList = (prods || []) as any[];
    const prodMap: Record<string, { id: string; name: string }> = {};
    prodList.forEach((p: any) => { prodMap[p.id] = p; });
    setProducts(prodList);
    setReviews(rows.map((r: any) => ({ ...r, products: prodMap[r.product_id] || null })));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const productSummary = useMemo(() => {
    const m = new Map<string, { id: string; name: string; total: number; pending: number; approved: number; avg: number; sum: number }>();
    reviews.forEach(r => {
      const id = r.product_id;
      const name = r.products?.name || "—";
      if (!m.has(id)) m.set(id, { id, name, total: 0, pending: 0, approved: 0, avg: 0, sum: 0 });
      const e = m.get(id)!;
      e.total++; e.sum += r.rating || 0;
      if (r.status === "pending") e['pending']++;
      if (r.status === "approved") e.approved++;
    });
    return Array.from(m.values()).map(e => ({ ...e, avg: e.total ? +(e.sum / e.total).toFixed(1) : 0 })).sort((a, b) => b.total - a.total);
  }, [reviews]);

  const filtered = reviews.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (productFilter !== "all" && r.product_id !== productFilter) return false;
    if (ratingFilter !== "all" && r.rating !== ratingFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${r.user_name || ""} ${r.title || ""} ${r.comment || ""} ${r.products?.name || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any).from("product_reviews").update({ status }).eq("id", id);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: `✅ Review ${status}` });
    fetchAll();
  };
  const del = async (id: string) => {
    if (!confirm("Delete this review?")) return;
    await trashDelete("product_reviews", id);
    toast({ title: "✅ Deleted" });
    fetchAll();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editing || !e.target.files) return;
    setUploading(true);
    const urls: string[] = [];
    const { data: { session } } = await supabase.auth.getSession();
    const folder = session?.user?.id || "admin";
    for (const file of Array.from(e.target.files)) {
      if (file.size > 3 * 1024 * 1024) { toast({ title: "Max 3MB per image", variant: "destructive" }); continue; }
      const ext = file.name.split(".").pop();
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("review-images").upload(path, file);
      if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); continue; }
      const { data } = supabase.storage.from("review-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    setEditing({ ...editing, images: [...(editing.images || []), ...urls].slice(0, 5) });
    setUploading(false);
    e.target.value = "";
  };

  const removeImage = (i: number) => {
    if (!editing) return;
    setEditing({ ...editing, images: (editing.images || []).filter((_: any, idx: number) => idx !== i) });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.product_id) { toast({ title: "Please select a product", variant: "destructive" }); return; }
    if (!editing.user_name?.trim()) { toast({ title: "Reviewer name required", variant: "destructive" }); return; }
    if (!editing.comment?.trim()) { toast({ title: "Comment required", variant: "destructive" }); return; }

    const payload = {
      product_id: editing.product_id,
      user_name: editing.user_name,
      rating: editing.rating,
      title: editing.title || null,
      comment: editing.comment,
      images: editing.images || [],
      is_verified_purchase: !!editing.is_verified_purchase,
      status: editing.status || "approved",
      created_at: editing.created_at ? new Date(editing.created_at).toISOString() : new Date().toISOString(),
    };

    let error;
    if (editing.id) {
      ({ error } = await (supabase as any).from("product_reviews").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await (supabase as any).from("product_reviews").insert({ ...payload, user_id: null }));
    }
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing.id ? "✅ Saved" : "✅ Review added" });
    setEditing(null);
    fetchAll();
  };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h2 className="text-2xl font-bold text-foreground">⭐ Product Reviews</h2>
        <button
          onClick={() => setEditing(emptyDraft(productFilter !== "all" ? productFilter : ""))}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Review
        </button>
      </div>

      {/* Per-product summary */}
      {productSummary.length > 0 && (
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Products with reviews</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => setProductFilter("all")}
              className={`text-left p-3 rounded-xl border transition ${productFilter === "all" ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"}`}
            >
              <div className="flex items-center gap-2 font-semibold text-sm"><Package className="h-4 w-4" /> All products</div>
              <p className="text-xs text-muted-foreground mt-1">{reviews.length} reviews total</p>
            </button>
            {productSummary.map(p => (
              <button key={p.id} onClick={() => setProductFilter(p.id)}
                className={`text-left p-3 rounded-xl border transition ${productFilter === p.id ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"}`}>
                <p className="font-semibold text-sm line-clamp-1">{p.name}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> {p.avg}</span>
                  <span>·</span>
                  <span>{p.total} total</span>
                  {p['pending'] > 0 && <span className="text-yellow-600 font-semibold">· {p['pending']} pending</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-3 flex-wrap items-center">
        {(["all", "pending", "approved", "rejected"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${filter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"}`}>
            {f} {f !== "all" && `(${reviews.filter(r => r.status === f).length})`}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm">
          <option value="all">All products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={ratingFilter as any} onChange={e => setRatingFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm">
          <option value="all">All ratings</option>
          {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} ★</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name / comment"
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm flex-1 min-w-[180px]" />
        {(productFilter !== "all" || ratingFilter !== "all" || search) && (
          <button onClick={() => { setProductFilter("all"); setRatingFilter("all"); setSearch(""); }}
            className="text-xs text-muted-foreground underline">Clear</button>
        )}
      </div>

      {!(search.trim() || productFilter !== "all" || filter !== "all" || ratingFilter !== "all") ? (
        <div className="bg-card rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">
          🔍 Search a reviewer / comment above, or pick a product / status filter to load reviews.
        </div>
      ) : (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr>
              <th className="text-left px-4 py-3">Product</th>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Rating</th>
              <th className="text-left px-4 py-3">Comment</th>
              <th className="text-left px-4 py-3">Photos</th>
              <th className="text-left px-4 py-3">Date & Time</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
              filtered.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No reviews</td></tr> :
              filtered.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{r.products?.name || "—"}</td>
                  <td className="px-4 py-3">{r.user_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-border"}`} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {r.title && <p className="font-medium text-xs">{r.title}</p>}
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.comment}</p>
                  </td>
                  <td className="px-4 py-3">
                    {r.images && r.images.length > 0 ? (
                      <div className="flex gap-1">
                        {r.images.slice(0, 3).map((u: string, i: number) => (
                          <a key={i} href={u} target="_blank" rel="noopener noreferrer">
                            <img loading="lazy" decoding="async" src={u} alt="" className="w-10 h-10 rounded object-cover border border-border" />
                          </a>
                        ))}
                        {r.images.length > 3 && <span className="text-xs text-muted-foreground self-center">+{r.images.length - 3}</span>}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                    {r.created_at ? new Date(r.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${r.status === "approved" ? "bg-primary/10 text-primary" : r.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-600"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {r.status !== "approved" && <button onClick={() => updateStatus(r.id, "approved")} title="Approve" className="p-1.5 hover:bg-primary/10 rounded"><Check className="h-4 w-4 text-primary" /></button>}
                      {r.status !== "rejected" && <button onClick={() => updateStatus(r.id, "rejected")} title="Reject" className="p-1.5 hover:bg-destructive/10 rounded"><X className="h-4 w-4 text-destructive" /></button>}
                      <button onClick={() => setEditing({ ...r, images: r.images || [] })} title="Edit" className="p-1.5 hover:bg-muted rounded"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => del(r.id)} title="Delete" className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}


      {editing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-5 space-y-3 shadow-xl my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{editing.id ? "Edit review" : "Add review"}</h3>
              <button onClick={() => setEditing(null)} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">Product</label>
              <select value={editing.product_id || ""} onChange={e => setEditing({ ...editing, product_id: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background">
                <option value="">-- Select product --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">Reviewer name</label>
              <input value={editing.user_name || ""} onChange={e => setEditing({ ...editing, user_name: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Rating</label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <button key={i} type="button" onClick={() => setEditing({ ...editing, rating: i })}>
                    <Star className={`h-6 w-6 ${i <= (editing.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Title</label>
              <input value={editing.title || ""} onChange={e => setEditing({ ...editing, title: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">Comment</label>
              <textarea rows={4} value={editing.comment || ""} onChange={e => setEditing({ ...editing, comment: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-2">Photos (up to 5, 3MB each)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(editing.images || []).map((url: string, i: number) => (
                  <div key={i} className="relative w-16 h-16">
                    <img loading="lazy" decoding="async" src={url} alt="" className="w-full h-full rounded-lg object-cover border border-border" />
                    <button onClick={() => removeImage(i)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {(editing.images || []).length < 5 && (
                  <label className="w-16 h-16 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
                  </label>
                )}
              </div>
              <input value="" placeholder="…or paste image URL and press Enter"
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    e.preventDefault();
                    setEditing({ ...editing, images: [...(editing.images || []), e.currentTarget.value.trim()].slice(0, 5) });
                    e.currentTarget.value = "";
                  }
                }}
                className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background" />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">Review date &amp; time</label>
              <input type="datetime-local" value={toLocalInput(editing.created_at)}
                onChange={e => setEditing({ ...editing, created_at: e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString() })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              <p className="text-[11px] text-muted-foreground mt-1">Shown to customers on the product page.</p>
            </div>


            <div>
              <label className="text-xs font-semibold block mb-1">Status</label>
              <select value={editing.status || "approved"} onChange={e => setEditing({ ...editing, status: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background">
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!editing.is_verified_purchase} onChange={e => setEditing({ ...editing, is_verified_purchase: e.target.checked })} />
              Verified purchase
            </label>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-border text-sm">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminReviews;
