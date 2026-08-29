import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Truck, IndianRupee, Package, Save } from "lucide-react";

const AdminDeliverySettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shippingCharge, setShippingCharge] = useState("49");
  const [shippingThreshold, setShippingThreshold] = useState("499");
  const [codMinAmount, setCodMinAmount] = useState("0");
  const [codMaxAmount, setCodMaxAmount] = useState("0");
  const [codEnabled, setCodEnabled] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["shipping_charge", "shipping_threshold", "cod_min_amount", "cod_max_amount", "cod_enabled"]);
      if (data) {
        data.forEach((s) => {
          if (s.key === "shipping_charge") setShippingCharge(s.value || "49");
          if (s.key === "shipping_threshold") setShippingThreshold(s.value || "499");
          if (s.key === "cod_min_amount") setCodMinAmount(s.value || "0");
          if (s.key === "cod_max_amount") setCodMaxAmount(s.value || "0");
          if (s.key === "cod_enabled") setCodEnabled(s.value !== "false");
        });
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const upsert = async (key: string, value: string) => {
    const now = new Date().toISOString();
    const { data: existing } = await supabase.from("site_settings").select("id").eq("key", key).maybeSingle();
    if (existing) {
      return supabase.from("site_settings").update({ value, updated_at: now }).eq("key", key);
    }
    return supabase.from("site_settings").insert({ key, value });
  };

  const handleSave = async () => {
    setSaving(true);
    const results = await Promise.all([
      upsert("shipping_charge", shippingCharge),
      upsert("shipping_threshold", shippingThreshold),
      upsert("cod_min_amount", codMinAmount),
      upsert("cod_max_amount", codMaxAmount),
      upsert("cod_enabled", codEnabled ? "true" : "false"),
    ]);
    const hasError = results.some((r: any) => r.error);
    setSaving(false);
    if (hasError) {
      toast({ title: "Save failed", variant: "destructive" });
    } else {
      toast({ title: "✅ Delivery settings saved!" });
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Delivery Settings</h2>

      <div className="bg-card rounded-xl border border-border p-6 space-y-6 max-w-lg">
        {/* Shipping Charge */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Truck className="h-4 w-4 text-primary" />
            Shipping Charge (₹)
          </label>
          <p className="text-xs text-muted-foreground">
            This amount will be charged as delivery fee when order is below the free delivery threshold.
          </p>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="number"
              min="0"
              value={shippingCharge}
              onChange={(e) => setShippingCharge(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Free Delivery Threshold */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Package className="h-4 w-4 text-primary" />
            Free Delivery Above (₹)
          </label>
          <p className="text-xs text-muted-foreground">
            Orders above this amount will get FREE delivery. Set 0 to always charge delivery.
          </p>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="number"
              min="0"
              value={shippingThreshold}
              onChange={(e) => setShippingThreshold(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* COD On/Off */}
        <div className="flex items-center justify-between gap-4 bg-muted/40 border border-border rounded-xl p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Cash on Delivery (COD)</p>
            <p className="text-xs text-muted-foreground">Off karne par checkout par COD option bilkul nahi dikhega — sirf online payment.</p>
          </div>
          <button type="button" onClick={() => setCodEnabled(v => !v)}
            className={`relative w-12 h-6 rounded-full transition ${codEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${codEnabled ? "left-6" : "left-0.5"}`} />
          </button>
        </div>

        {/* COD Min */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <IndianRupee className="h-4 w-4 text-primary" />
            COD Minimum Order (₹)
          </label>
          <p className="text-xs text-muted-foreground">
            Cash on Delivery option will be hidden for orders BELOW this amount. Set 0 to allow COD on all orders.
          </p>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="number" min="0" value={codMinAmount} onChange={(e) => setCodMinAmount(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
          </div>
        </div>

        {/* COD Max */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <IndianRupee className="h-4 w-4 text-primary" />
            COD Maximum Order (₹)
          </label>
          <p className="text-xs text-muted-foreground">
            Cash on Delivery option will be disabled for orders ABOVE this amount. Set 0 for no upper limit.
          </p>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="number" min="0" value={codMaxAmount} onChange={(e) => setCodMaxAmount(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
          </div>
        </div>

        {/* Preview */}
        <div className="bg-muted/60 rounded-xl p-4 space-y-1.5 border border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</p>
          <p className="text-sm">
            Orders below <span className="font-bold text-foreground">₹{shippingThreshold || "0"}</span> → <span className="font-bold text-destructive">₹{shippingCharge || "0"} delivery charge</span>
          </p>
          <p className="text-sm">
            Orders above <span className="font-bold text-foreground">₹{shippingThreshold || "0"}</span> → <span className="font-bold text-green-600">FREE delivery 🎉</span>
          </p>
          {Number(codMinAmount) > 0 && (
            <p className="text-sm">COD hidden below <span className="font-bold text-foreground">₹{codMinAmount}</span></p>
          )}
          {Number(codMaxAmount) > 0 && (
            <p className="text-sm">COD disabled above <span className="font-bold text-foreground">₹{codMaxAmount}</span></p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Delivery Settings"}
        </button>
      </div>
    </div>
  );
};

export default AdminDeliverySettings;
