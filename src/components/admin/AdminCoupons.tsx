import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { trashDelete } from "@/lib/trash";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus } from "lucide-react";

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const { toast } = useToast();
  const [form, setForm] = useState({ code: "", discount_type: "percentage", discount_value: "", min_order_value: "", max_uses: "", is_active: true });

  const fetch = async () => {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    setCoupons(data || []); setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const reset = () => { setForm({ code: "", discount_type: "percentage", discount_value: "", min_order_value: "", max_uses: "", is_active: true }); setEditing(null); };

  const save = async () => {
    if (!form.code) { toast({ title: "Coupon code is required", variant: "destructive" }); return; }
    const payload = {
      code: form.code.toUpperCase().trim(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value) || 0,
      min_order_value: parseFloat(form.min_order_value) || 0,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      is_active: form.is_active,
    };
    if (editing) {
      const { error } = await supabase.from("coupons").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "✅ Coupon updated!" });
    } else {
      const { error } = await supabase.from("coupons").insert(payload);
      if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "✅ Coupon created!" });
    }
    reset(); fetch();
  };

  const toggleActive = async (c: any) => {
    const newVal = !c.is_active;
    setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, is_active: newVal } : x));
    const { error } = await supabase.from("coupons").update({ is_active: newVal }).eq("id", c.id);
    if (error) {
      setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, is_active: c.is_active } : x));
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: newVal ? "✅ Coupon activated" : "⏸️ Coupon deactivated" });
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    await trashDelete("coupons", id);
    toast({ title: "✅ Coupon deleted" }); fetch();
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Coupons Management</h2>
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Plus className="h-4 w-4" /> {editing ? "Edit" : "Add"} Coupon</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input placeholder="Coupon Code *" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background uppercase" />
          <select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
            <option value="percentage">Percentage (%)</option><option value="fixed">Fixed Amount (₹)</option>
          </select>
          <input placeholder="Discount Value *" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} type="number" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Min Order Value ₹" value={form.min_order_value} onChange={e => setForm({ ...form, min_order_value: e.target.value })} type="number" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Max Uses (blank = unlimited)" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} type="number" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={save} className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition">{editing ? "Update" : "Create"}</button>
          {editing && <button onClick={reset} className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm">Cancel</button>}
        </div>
      </div>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground w-10">#</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Discount</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Min Order</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Used</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
            coupons.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No coupons yet</td></tr> :
            coupons.map((c, idx) => (
              <tr key={c.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-3 py-3 text-xs font-semibold text-muted-foreground">{idx + 1}</td>
                <td className="px-4 py-3 font-mono font-bold">{c.code}</td>
                <td className="px-4 py-3">{c.discount_value}{c.discount_type === "percentage" ? "%" : "₹"}</td>
                <td className="px-4 py-3">₹{c.min_order_value || 0}</td>
                <td className="px-4 py-3">{c.used_count}/{c.max_uses || "∞"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(c)}
                    title="Click to toggle"
                    className={`text-xs px-3 py-1 rounded-full font-semibold transition hover:opacity-80 ${c.is_active ? "bg-green-100 text-green-800 border border-green-300" : "bg-muted text-muted-foreground border border-border"}`}
                  >
                    {c.is_active ? "● Active" : "○ Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3"><div className="flex gap-1">
                  <button onClick={() => { setEditing(c); setForm({ code: c.code, discount_type: c.discount_type, discount_value: String(c.discount_value), min_order_value: String(c.min_order_value || ""), max_uses: c.max_uses ? String(c.max_uses) : "", is_active: c.is_active }); }} className="p-1.5 hover:bg-secondary rounded"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                  <button onClick={() => del(c.id)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminCoupons;
