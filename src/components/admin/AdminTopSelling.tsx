import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, X, Flame, Search } from "lucide-react";

type Config = {
  mode: "auto" | "manual";
  product_ids: string[];
  title: string;
  title_hi: string;
  subtitle: string;
  subtitle_hi: string;
  days: number;
  limit: number;
};

const DEFAULT: Config = { mode: "auto", product_ids: [], title: "🔥 Top Selling Products", title_hi: "🔥 टॉप सेलिंग प्रोडक्ट्स", subtitle: "Trusted by Thousands, Chosen Every Day", subtitle_hi: "हज़ारों का भरोसा, हर दिन की पसंद", days: 30, limit: 8 };

const AdminTopSelling = () => {
  const [cfg, setCfg] = useState<Config>(DEFAULT);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data: row } = await supabase.from("site_settings").select("value").eq("key", "top_selling_config").maybeSingle();
      if (row?.value) {
        try { setCfg({ ...DEFAULT, ...(typeof row.value === "string" ? JSON.parse(row.value) : row.value) }); } catch {}
      }
      const { data } = await supabase.from("products").select("id,name,image_url,price,is_active").eq("is_active", true).order("name").limit(500);
      setProducts(data || []);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("site_settings").upsert({ key: "top_selling_config", value: cfg }, { onConflict: "key" });
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "✅ Saved" });
  };

  const toggle = (id: string) => {
    setCfg(c => c.product_ids.includes(id)
      ? { ...c, product_ids: c.product_ids.filter(x => x !== id) }
      : { ...c, product_ids: [...c.product_ids, id] });
  };

  const filtered = products.filter(p => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><Flame className="h-5 w-5 text-orange-500" /> Top Selling Section</h2>
          <p className="text-xs text-muted-foreground">Auto-detect best sellers from real orders, or pick manually.</p>
        </div>
        <button onClick={save} disabled={saving} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Title (English)</label>
            <input value={cfg.title} onChange={e => setCfg({ ...cfg, title: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Title (Hindi)</label>
            <input value={cfg.title_hi} onChange={e => setCfg({ ...cfg, title_hi: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Subtitle (English)</label>
            <input value={cfg.subtitle} onChange={e => setCfg({ ...cfg, subtitle: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Subtitle (Hindi)</label>
            <input value={cfg.subtitle_hi} onChange={e => setCfg({ ...cfg, subtitle_hi: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Mode</label>
            <select value={cfg.mode} onChange={e => setCfg({ ...cfg, mode: e.target.value as any })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background">
              <option value="auto">Auto (from orders)</option>
              <option value="manual">Manual selection</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Auto window (days)</label>
            <input type="number" value={cfg.days} onChange={e => setCfg({ ...cfg, days: parseInt(e.target.value) || 30 })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Show products</label>
            <input type="number" value={cfg.limit} onChange={e => setCfg({ ...cfg, limit: parseInt(e.target.value) || 8 })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </div>
        </div>
      </div>

      {cfg.mode === "manual" && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3 gap-3">
            <h3 className="font-semibold text-sm">Manually selected ({cfg.product_ids.length})</h3>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[500px] overflow-y-auto">
            {filtered.map(p => {
              const sel = cfg.product_ids.includes(p.id);
              const order = cfg.product_ids.indexOf(p.id);
              return (
                <button key={p.id} onClick={() => toggle(p.id)} className={`relative p-2 rounded-lg border-2 text-left transition ${sel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  {sel && <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{order + 1}</span>}
                  {p.image_url ? <img loading="lazy" decoding="async" src={p.image_url} className="w-full aspect-square object-cover rounded mb-1" /> : <div className="w-full aspect-square bg-muted rounded mb-1 flex items-center justify-center text-2xl">🌿</div>}
                  <div className="text-[11px] font-medium line-clamp-2">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">₹{p['price']}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTopSelling;
