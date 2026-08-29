import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Save, Timer, Percent } from "lucide-react";
import { resetCountdownCache } from "@/components/ProductCountdown";
import { resetCountdownDiscountCache } from "@/hooks/use-countdown-discount";

const FIELDS: { key: string; label: string; placeholder: string; type?: string }[] = [
  { key: "countdown_enabled", label: "Show Countdown Bar", placeholder: "true / false" },
  { key: "countdown_sale_title", label: "Title (English)", placeholder: "🔥 SUNDAY MEGA SALE" },
  { key: "countdown_sale_title_hi", label: "Title (Hindi)", placeholder: "🔥 रविवार मेगा सेल" },
  { key: "countdown_sale_subtitle", label: "Subtitle (English)", placeholder: "Flat 50% OFF on All Products!" },
  { key: "countdown_sale_subtitle_hi", label: "Subtitle (Hindi)", placeholder: "सभी उत्पादों पर फ्लैट 50% की छूट!" },
  { key: "countdown_sale_starts_at", label: "Starts At (exact date & time — optional, overrides Sale Day)", placeholder: "", type: "datetime-local" },
  { key: "countdown_sale_ends_at", label: "Ends At (exact date & time — optional, overrides Sale Day)", placeholder: "", type: "datetime-local" },
  { key: "countdown_sale_day", label: "Sale Day (0=Sun ... 6=Sat) — used only if exact dates above are empty", placeholder: "0", type: "saleday" },
  { key: "countdown_sale_cta_text", label: "CTA Button (English)", placeholder: "SHOP NOW" },
  { key: "countdown_sale_cta_text_hi", label: "CTA Button (Hindi)", placeholder: "अभी खरीदें" },
  { key: "countdown_sale_color_from", label: "Gradient Start Color", placeholder: "#f59e0b" },
  { key: "countdown_sale_color_via", label: "Gradient Middle Color", placeholder: "#f97316" },
  { key: "countdown_sale_color_to", label: "Gradient End Color", placeholder: "#f43f5e" },
];

const DISCOUNT_KEYS = [
  "countdown_discount_enabled",
  "countdown_discount_percent",
  "countdown_discount_scope",
  "countdown_discount_category_id",
  "countdown_discount_product_ids",
  "countdown_discount_starts_at",
  "countdown_discount_ends_at",
];

const ALL_KEYS = [...FIELDS.map(f => f.key), ...DISCOUNT_KEYS];

const AdminCountdown = () => {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: c }, { data: p }] = await Promise.all([
        supabase.from("site_settings").select("key, value").in("key", ALL_KEYS),
        supabase.from("categories").select("id, name").order("name"),
        supabase.from("products").select("id, name").order("name"),
      ]);
      const m: Record<string, string> = {};
      (s || []).forEach((x: any) => { m[x.key] = x.value || ""; });
      setValues(m);
      setCategories(c || []);
      setProducts(p || []);
      setLoading(false);
    })();
  }, []);

  const upsert = async (key: string, value: string) => {
    const now = new Date().toISOString();
    const { data: existing } = await supabase.from("site_settings").select("id").eq("key", key).maybeSingle();
    if (existing) return supabase.from("site_settings").update({ value, updated_at: now }).eq("key", key);
    return supabase.from("site_settings").insert({ key, value });
  };

  const save = async () => {
    setSaving(true);
    const results = await Promise.all(ALL_KEYS.map(k => upsert(k, values[k] || "")));
    setSaving(false);
    resetCountdownCache();
    resetCountdownDiscountCache();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("countdown-sale-updated"));
    if (results.some((r: any) => r.error)) {
      toast({ title: "Save failed", description: results.find((r: any) => r.error)?.error?.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Countdown settings saved!" });
    }
  };

  const toggleProductId = (id: string) => {
    const ids = (values['countdown_discount_product_ids'] || "").split(",").map(s => s.trim()).filter(Boolean);
    const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
    setValues(v => ({ ...v, countdown_discount_product_ids: next.join(",") }));
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  const discountEnabled = values['countdown_discount_enabled'] === "true";
  const scope = values['countdown_discount_scope'] || "all";
  const selectedProductIds = (values['countdown_discount_product_ids'] || "").split(",").map(s => s.trim()).filter(Boolean);

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2"><Timer className="h-6 w-6 text-primary" /> Front-Page Countdown Sale</h2>
      <p className="text-sm text-muted-foreground mb-6">Configure the countdown banner & automatic discount that activates during the sale window.</p>

      <div className="bg-card rounded-xl border border-border p-5 space-y-4 max-w-2xl mb-6">
        <div className="flex items-center justify-between bg-muted/40 rounded-xl p-4 border border-border">
          <div>
            <p className="font-bold text-sm">Sale Countdown {values['countdown_enabled'] !== "false" ? "Active" : "Inactive"}</p>
            <p className="text-xs text-muted-foreground">Toggle to show / hide the countdown bar on the home page</p>
          </div>
          <button type="button"
            onClick={() => setValues(v => ({ ...v, countdown_enabled: v['countdown_enabled'] === "false" ? "true" : "false" }))}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${values['countdown_enabled'] !== "false" ? "bg-primary" : "bg-muted-foreground/40"}`}>
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${values['countdown_enabled'] !== "false" ? "translate-x-8" : "translate-x-1"}`} />
          </button>
        </div>

        {FIELDS.filter(f => f.key !== "countdown_enabled").map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-sm font-semibold text-foreground">{f.label}</label>
            <input
              type={f.type === "datetime-local" ? "datetime-local" : (f.type === "number" || f.type === "saleday") ? "number" : "text"}
              min={f.type === "saleday" ? 0 : undefined}
              max={f.type === "saleday" ? 6 : undefined}
              step={f.type === "saleday" ? 1 : undefined}
              placeholder={f.placeholder}
              value={values[f.key] || ""}
              onChange={(e) => {
                let val = e.target.value;
                if (f.type === "saleday") {
                  const n = parseInt(val);
                  if (!isNaN(n)) val = String(Math.max(0, Math.min(6, n)));
                }
                setValues(v => ({ ...v, [f.key]: val }));
              }}
              className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm bg-background focus:border-primary focus:outline-none"
            />
            {f.key.includes("color") && values[f.key] && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-6 h-6 rounded border border-border" style={{ background: values[f.key] }} />
                <span className="font-mono">{values[f.key]}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Discount config */}
      <div className="bg-card rounded-xl border-2 border-cta/30 p-5 space-y-4 max-w-2xl mb-6">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><Percent className="h-5 w-5 text-cta" /> Auto-Apply Discount</h3>
        <p className="text-xs text-muted-foreground">When enabled & within the date/time window, this discount % is automatically applied to product prices on the site.</p>

        <div className="flex items-center justify-between bg-muted/40 rounded-xl p-3 border border-border">
          <div>
            <p className="font-bold text-sm">Discount {discountEnabled ? "Active" : "Inactive"}</p>
            <p className="text-xs text-muted-foreground">Toggle on to auto-apply discount during the window</p>
          </div>
          <button type="button"
            onClick={() => setValues(v => ({ ...v, countdown_discount_enabled: discountEnabled ? "false" : "true" }))}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${discountEnabled ? "bg-cta" : "bg-muted-foreground/40"}`}>
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${discountEnabled ? "translate-x-8" : "translate-x-1"}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground">Discount %</label>
            <input type="number" min="0" max="100" placeholder="20"
              value={values['countdown_discount_percent'] || ""}
              onChange={e => setValues(v => ({ ...v, countdown_discount_percent: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border-2 border-border rounded-lg text-sm bg-background" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground">Starts At</label>
            <input type="datetime-local"
              value={values['countdown_discount_starts_at'] || ""}
              onChange={e => setValues(v => ({ ...v, countdown_discount_starts_at: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border-2 border-border rounded-lg text-sm bg-background" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground">Ends At</label>
            <input type="datetime-local"
              value={values['countdown_discount_ends_at'] || ""}
              onChange={e => setValues(v => ({ ...v, countdown_discount_ends_at: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border-2 border-border rounded-lg text-sm bg-background" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Apply To</label>
          <div className="flex gap-2 flex-wrap">
            {(["all", "category", "products"] as const).map(s => (
              <button key={s} type="button"
                onClick={() => setValues(v => ({ ...v, countdown_discount_scope: s }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition ${scope === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground"}`}>
                {s === "all" ? "All Products" : s === "category" ? "By Category" : "Selected Products"}
              </button>
            ))}
          </div>
        </div>

        {scope === "category" && (
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Category</label>
            <select value={values['countdown_discount_category_id'] || ""}
              onChange={e => setValues(v => ({ ...v, countdown_discount_category_id: e.target.value }))}
              className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm bg-background">
              <option value="">-- Select category --</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {scope === "products" && (
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Select Products ({selectedProductIds.length} selected)</label>
            <div className="max-h-60 overflow-y-auto border border-border rounded-lg p-2 space-y-1 bg-background">
              {products.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                  <input type="checkbox" checked={selectedProductIds.includes(p.id)} onChange={() => toggleProductId(p.id)} />
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
        <Save className="h-4 w-4" />
        {saving ? "Saving..." : "Save Countdown Settings"}
      </button>
    </div>
  );
};

export default AdminCountdown;
