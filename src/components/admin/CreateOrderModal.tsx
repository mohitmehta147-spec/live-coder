import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { X, Plus, Trash2 } from "lucide-react";

type Variation = { label: string; mrp?: number; price: number };
type Product = { id: string; name: string; price: number; mrp: number; variations?: Variation[] | null };
type Item = { product_id: string | null; product_name: string; quantity: number; price: number; variation_label?: string; variations?: Variation[] };

const CreateOrderModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: "", customer_phone: "", customer_email: "",
    address: "", city: "", state: "", pincode: "",
    payment_method: "cod", payment_status: "cod",
    status: "pending", shipping: "0", discount: "0", notes: "",
  });
  const [items, setItems] = useState<Item[]>([{ product_id: null, product_name: "", quantity: 1, price: 0 }]);

  useEffect(() => {
    supabase.from("products").select("id, name, price, mrp, variations").order("name").then(({ data }) => setProducts((data as any) || []));
  }, []);

  const subtotal = items.reduce((s, i) => s + i['price'] * i.quantity, 0);
  const total = subtotal + (parseFloat(form.shipping) || 0) - (parseFloat(form.discount) || 0);

  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItems(arr => arr.map((it, i) => i === idx ? { ...it, ...patch } : it));

  const pickProduct = (idx: number, productId: string) => {
    const p = products.find(x => x.id === productId);
    if (!p) return updateItem(idx, { product_id: null, variations: [], variation_label: undefined });
    const vars = Array.isArray(p['variations']) ? p['variations'] : [];
    const firstVar = vars[0];
    updateItem(idx, {
      product_id: p.id,
      product_name: firstVar ? `${p.name} (${firstVar.label})` : p.name,
      price: firstVar ? Number(firstVar['price']) || 0 : Number(p['price']) || 0,
      variations: vars,
      variation_label: firstVar?.label,
    });
  };

  const pickVariation = (idx: number, label: string) => {
    const it = items[idx];
    const baseName = (it.product_name || "").replace(/\s*\([^)]*\)\s*$/, "");
    const v = (it['variations'] || []).find(x => x.label === label);
    if (!v) return;
    updateItem(idx, { variation_label: label, price: Number(v['price']) || 0, product_name: `${baseName} (${label})` });
  };

  const handleSave = async () => {
    if (!form.customer_name.trim() || !form.customer_phone.trim() || !form.address.trim()) {
      toast({ title: "Name, phone & address are required", variant: "destructive" }); return;
    }
    const validItems = items.filter(i => i.product_name.trim() && i.quantity > 0);
    if (!validItems.length) { toast({ title: "Add at least one item", variant: "destructive" }); return; }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload: any = {
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim(),
      customer_email: form.customer_email.trim() || null,
      address: form.address.trim(),
      city: form.city || null, state: form.state || null, pincode: form.pincode || null,
      payment_method: form.payment_method, payment_status: form.payment_status,
      status: form.status,
      shipping: parseFloat(form.shipping) || 0,
      discount: parseFloat(form.discount) || 0,
      subtotal, total,
      notes: form.notes || null,
      user_id: userData.user?.id || null,
      items: validItems,
    };
    const { data: order, error } = await supabase.from("orders").insert(payload).select().single();
    if (error || !order) {
      setSaving(false);
      toast({ title: "Create failed", description: error?.message, variant: "destructive" }); return;
    }
    const itemRows = validItems.map(i => ({
      order_id: order.id, product_id: i.product_id, product_name: i.product_name,
      quantity: i.quantity, price: i['price'],
    }));
    await supabase.from("order_items").insert(itemRows);
    setSaving(false);
    toast({ title: `✅ Order created: ${order.order_number || order.id.slice(0, 8)}` });
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-3xl my-8">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card rounded-t-xl">
          <h3 className="font-bold text-foreground">➕ Create Manual Order</h3>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input placeholder="Customer Name *" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <input placeholder="Phone *" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <input placeholder="Email" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background sm:col-span-2" />
            <input placeholder="Address *" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background sm:col-span-2" />
            <input placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <input placeholder="State" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <input placeholder="Pincode" value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
            </select>
            <select value={form.payment_status} onChange={e => setForm({ ...form, payment_status: e.target.value, payment_method: e.target.value === "paid" ? "manual" : "cod" })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
              <option value="cod">COD</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">Order Items</label>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="space-y-1.5 p-2 border border-border/60 rounded-lg">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <select value={it.product_id || ""} onChange={e => pickProduct(idx, e.target.value)} className="col-span-12 sm:col-span-5 px-2 py-2 border border-border rounded-lg text-xs bg-background">
                      <option value="">-- Select product --</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input placeholder="Name" value={it.product_name} onChange={e => updateItem(idx, { product_name: e.target.value })} className="col-span-6 sm:col-span-3 px-2 py-2 border border-border rounded-lg text-xs bg-background" />
                    <input type="number" placeholder="Qty" value={it.quantity} onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })} className="col-span-3 sm:col-span-1 px-2 py-2 border border-border rounded-lg text-xs bg-background" />
                    <input type="number" placeholder="Price" value={it['price']} onChange={e => updateItem(idx, { price: parseFloat(e.target.value) || 0 })} className="col-span-3 sm:col-span-2 px-2 py-2 border border-border rounded-lg text-xs bg-background" />
                    <button onClick={() => setItems(arr => arr.filter((_, i) => i !== idx))} className="col-span-12 sm:col-span-1 p-2 text-destructive hover:bg-destructive/10 rounded-lg flex justify-center"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {it['variations'] && it['variations'].length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-1">
                      <span className="text-[10px] text-muted-foreground font-semibold">Variation:</span>
                      {it['variations'].map(v => (
                        <button key={v.label} type="button" onClick={() => pickVariation(idx, v.label)}
                          className={`px-2 py-1 rounded-md text-[11px] border transition ${it.variation_label === v.label ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"}`}>
                          {v.label} <span className="opacity-70">₹{v['price']}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setItems(arr => [...arr, { product_id: null, product_name: "", quantity: 1, price: 0 }])} className="mt-2 text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg flex items-center gap-1 hover:opacity-90"><Plus className="h-3 w-3" /> Add Item</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><label className="text-[10px] text-muted-foreground">Subtotal</label><div className="px-3 py-2 border border-border rounded-lg text-sm bg-muted">₹{subtotal.toFixed(2)}</div></div>
            <div><label className="text-[10px] text-muted-foreground">Shipping</label><input type="number" value={form.shipping} onChange={e => setForm({ ...form, shipping: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" /></div>
            <div><label className="text-[10px] text-muted-foreground">Discount</label><input type="number" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" /></div>
            <div><label className="text-[10px] text-muted-foreground">Total</label><div className="px-3 py-2 border border-primary rounded-lg text-sm font-bold text-primary bg-primary/5">₹{total.toFixed(2)}</div></div>
          </div>

          <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />

          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {saving ? "Creating..." : "Create Order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateOrderModal;
