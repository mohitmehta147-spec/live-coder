import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { trashDelete } from "@/lib/trash";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2 } from "lucide-react";

const AdminOffers = () => {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const { toast } = useToast();
  const [form, setForm] = useState({ title: "", title_hi: "", description: "", discount_type: "percentage", discount_value: "", coupon_code: "", min_order_value: "", is_active: true });

  const fetchOffers = async () => {
    const { data } = await supabase.from("offers").select("*").order("sort_order");
    setOffers(data || []); setLoading(false);
  };
  useEffect(() => { fetchOffers(); }, []);

  const reset = () => { setForm({ title: "", title_hi: "", description: "", discount_type: "percentage", discount_value: "", coupon_code: "", min_order_value: "", is_active: true }); setEditing(null); };

  const save = async () => {
    const payload = { title: form.title, title_hi: form.title_hi || null, description: form.description || null, discount_type: form.discount_type, discount_value: parseFloat(form.discount_value) || 0, coupon_code: form.coupon_code || null, min_order_value: parseFloat(form.min_order_value) || 0, is_active: form.is_active };
    if (editing) {
      const { error } = await supabase.from("offers").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "✅ Offer updated!" });
    } else {
      const { error } = await supabase.from("offers").insert(payload);
      if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "✅ Offer added!" });
    }
    reset(); fetchOffers();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this offer?")) return;
    await trashDelete("offers", id);
    toast({ title: "✅ Offer deleted" }); fetchOffers();
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Offers & Coupons</h2>
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-4">{editing ? "Edit" : "Add"} Offer</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Hindi Title" value={form.title_hi} onChange={(e) => setForm({ ...form, title_hi: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Coupon Code" value={form.coupon_code} onChange={(e) => setForm({ ...form, coupon_code: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
            <option value="percentage">Percentage (%)</option><option value="fixed">Fixed Amount (₹)</option>
          </select>
          <input placeholder="Discount Value" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} type="number" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Min Order Value ₹" value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: e.target.value })} type="number" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
        </div>
        <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-3 w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" rows={2} />
        <div className="flex items-center gap-3 mt-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
          <button onClick={save} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition">{editing ? "Update" : "Add"}</button>
          {editing && <button onClick={reset} className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm">Cancel</button>}
        </div>
      </div>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground w-10">#</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Discount</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Min Order</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
            offers.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No offers yet</td></tr> :
            offers.map((o, idx) => (
              <tr key={o.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-3 py-3 text-xs font-semibold text-muted-foreground">{idx + 1}</td>
                <td className="px-4 py-3 font-medium">{o.title}</td>
                <td className="px-4 py-3 font-mono text-xs">{o.coupon_code || "-"}</td>
                <td className="px-4 py-3">{o.discount_value}{o.discount_type === "percentage" ? "%" : "₹"}</td>
                <td className="px-4 py-3">₹{o.min_order_value}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${o.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{o.is_active ? "Active" : "Inactive"}</span></td>
                <td className="px-4 py-3"><div className="flex gap-1">
                  <button onClick={() => { setEditing(o); setForm({ title: o.title, title_hi: o.title_hi || "", description: o.description || "", discount_type: o.discount_type, discount_value: String(o.discount_value), coupon_code: o.coupon_code || "", min_order_value: String(o.min_order_value), is_active: o.is_active }); }} className="p-1.5 hover:bg-secondary rounded"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                  <button onClick={() => del(o.id)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminOffers;
