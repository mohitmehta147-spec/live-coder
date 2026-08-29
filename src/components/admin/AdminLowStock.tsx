import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, Package } from "lucide-react";

const AdminLowStock = () => {
  const [threshold, setThreshold] = useState(10);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from("products").select("id, name, stock, image_url, sku, price").lte("stock", threshold).order("stock", { ascending: true });
      setItems(data || []);
      setLoading(false);
    };
    load();
  }, [threshold]);

  const updateStock = async (id: string, stock: number) => {
    await supabase.from("products").update({ stock }).eq("id", id);
    setItems(prev => prev.map(p => p.id === id ? { ...p, stock } : p));
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-yellow-500" /> Low Stock Alerts</h2>

      <div className="bg-card rounded-xl border border-border p-4 mb-6 flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium">Alert threshold:</label>
        <input type="number" min={0} value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="w-24 px-3 py-2 border border-border rounded-lg text-sm bg-background" />
        <span className="text-xs text-muted-foreground">Showing products with stock ≤ {threshold}</span>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-4 py-3">Product</th>
            <th className="text-left px-4 py-3">SKU</th>
            <th className="text-left px-4 py-3">Price</th>
            <th className="text-left px-4 py-3">Current Stock</th>
            <th className="text-left px-4 py-3">Update</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
            items.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-muted-foreground flex items-center justify-center gap-2"><Package className="h-5 w-5" /> All products well stocked 🎉</td></tr> :
            items.map(p => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-3 flex items-center gap-2">{p.image_url && <img loading="lazy" decoding="async" src={p.image_url} alt="" className="w-10 h-10 rounded object-cover" />}<span className="font-medium">{p.name}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{p.sku || "—"}</td>
                <td className="px-4 py-3">₹{p['price']}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${p.stock === 0 ? "bg-destructive/10 text-destructive" : p.stock <= 5 ? "bg-yellow-500/10 text-yellow-600" : "bg-orange-500/10 text-orange-600"}`}>
                    {p.stock === 0 ? "OUT OF STOCK" : `${p.stock} left`}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <input type="number" min={0} defaultValue={p.stock} onBlur={e => { const v = Number(e.target.value); if (v !== p.stock) updateStock(p.id, v); }}
                    className="w-20 px-2 py-1 border border-border rounded text-sm bg-background" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default AdminLowStock;
