import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useDiscountedProducts } from "@/hooks/use-countdown-discount";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";

type Product = {
  id: string; name: string; name_hi: string | null; slug: string;
  price: number; mrp: number; rating: number | null; reviews_count: number | null;
  image_url: string | null; badge: string | null;
};

type Config = {
  mode: "auto" | "manual";
  product_ids: string[];
  title?: string;
  title_hi?: string;
  subtitle?: string;
  subtitle_hi?: string;
  days?: number;
  limit?: number;
};

const DEFAULT_CONFIG: Config = { mode: "auto", product_ids: [], title: "🔥 Top Selling Products", title_hi: "🔥 टॉप सेलिंग प्रोडक्ट्स", subtitle: "Trusted by Thousands, Chosen Every Day", subtitle_hi: "हज़ारों का भरोसा, हर दिन की पसंद", days: 30, limit: 8 };

const TopSellingProducts = () => {
  const [rawProducts, setProducts] = useState<Product[]>([]);
  const products = useDiscountedProducts(rawProducts) as Product[];
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const { t, lang } = useLanguage();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: cfgRow } = await supabase.from("site_settings").select("value").eq("key", "top_selling_config").maybeSingle();
      let cfg: Config = DEFAULT_CONFIG;
      try { if (cfgRow?.value) cfg = { ...DEFAULT_CONFIG, ...(typeof cfgRow.value === "string" ? JSON.parse(cfgRow.value) : cfgRow.value) }; } catch {}
      setConfig(cfg);
      const limit = cfg.limit || 8;

      let ids: string[] = [];
      // Orders are auth-protected; guests skip the sales lookup and fall back to popular products.
      const hasSession = typeof window !== "undefined" && !!localStorage.getItem("vu_auth_token");
      if (cfg.mode === "manual" && cfg.product_ids?.length) {
        ids = cfg.product_ids.slice(0, limit);
      } else if (hasSession) {
        const since = new Date(Date.now() - (cfg.days || 30) * 86400000).toISOString();
        const { data: orders } = await supabase
          .from("orders")
          .select("items")
          .gte("created_at", since)
          .neq("status", "cancelled")
          .limit(2000);
        const counts: Record<string, number> = {};
        (orders || []).forEach((o: any) => {
          const items = Array.isArray(o.items) ? o.items : [];
          items.forEach((it: any) => {
            const pid = it?.id || it?.product_id;
            const qty = Number(it?.quantity || it?.qty || 1);
            if (pid) counts[pid] = (counts[pid] || 0) + qty;
          });
        });
        ids = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
      }

      if (ids.length === 0) {
        const { data } = await supabase.from("products")
          .select("id,name,name_hi,slug,price,mrp,rating,reviews_count,image_url,badge")
          .eq("is_active", true)
          .order("reviews_count", { ascending: false, nullsFirst: false })
          .limit(limit);
        setProducts((data || []) as Product[]);
        return;
      }
      const q = supabase.from("products")
        .select("id,name,name_hi,slug,price,mrp,rating,reviews_count,image_url,badge")
        .in("id", ids);
      // In manual mode, respect admin's exact selection (don't drop inactive picks)
      const { data } = cfg.mode === "manual" ? await q : await q.eq("is_active", true);
      const ordered = ids.map(id => (data || []).find((p: any) => p.id === id)).filter(Boolean) as Product[];
      setProducts(ordered);

    })();
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="py-10 md:py-14 bg-linear-to-b from-orange-50/40 via-background to-background">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              {lang === "hi" ? (config.title_hi || config.title) : config.title}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">{lang === "hi" ? (config.subtitle_hi || config.subtitle) : config.subtitle}</p>
          </div>
          <Link to="/products" className="text-primary font-semibold text-sm hover:underline shrink-0">
            {t("View All →", "सब देखें →")}
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {products.map((p, idx) => {
            const discount = p['mrp'] > 0 ? Math.round(((p['mrp'] - p['price']) / p['mrp']) * 100) : 0;
            const name = lang === "hi" && p.name_hi ? p.name_hi : p.name;
            return (
              <div key={p.id} className="product-card group relative">
                <Link to="/product/$slug" params={{ slug: p.slug }}>
                  <div className="bg-muted aspect-square flex items-center justify-center relative overflow-hidden">
                    {p.image_url ? (
                      <img loading="lazy" decoding="async" src={p.image_url} alt={name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : <span className="text-5xl">🌿</span>}
                    {discount > 0 && (
                      <span className="absolute top-2 left-2 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-lg shadow-sm" style={{background: 'linear-gradient(135deg, hsl(0 84% 55%), hsl(15 90% 50%))', color: 'white'}}>{discount}% OFF</span>
                    )}
                  </div>
                </Link>
                <div className="p-3 md:p-4">
                  <Link to="/product/$slug" params={{ slug: p.slug }}>
                    <h3 className="font-semibold text-sm md:text-base text-foreground mb-1.5 line-clamp-2 hover:text-primary transition">{name}</h3>
                  </Link>
                  {p.rating && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-md font-semibold flex items-center gap-1"><Star className="h-3 w-3 fill-current" /> {p.rating}</span>
                      <span className="text-xs text-muted-foreground">({(p.reviews_count || 0).toLocaleString()})</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                    <span className="font-bold text-base md:text-xl text-foreground">₹{p['price']}</span>
                    {p['mrp'] > p['price'] && <span className="text-xs md:text-sm text-muted-foreground line-through">₹{p['mrp']}</span>}
                  </div>
                  <div className="flex gap-1.5 md:gap-2">
                    <button onClick={() => addToCart({ id: p.id, name: p.name, name_hi: p.name_hi, price: p['price'], mrp: p['mrp'], image_url: p.image_url, slug: p.slug })}
                      className="flex-1 flex items-center justify-center gap-1 bg-primary text-primary-foreground py-2 md:py-2.5 rounded-lg text-[11px] md:text-sm font-semibold hover:opacity-90 transition-all">
                      <ShoppingCart className="h-3 w-3 md:h-3.5 md:w-3.5 hidden md:block shrink-0" /> {t("Add to Cart", "कार्ट में")}
                    </button>
                    <button onClick={() => { addToCart({ id: p.id, name: p.name, name_hi: p.name_hi, price: p['price'], mrp: p['mrp'], image_url: p.image_url, slug: p.slug }); navigate({ to: "/checkout" }); }}
                      className="flex-1 text-center bg-cta hover:bg-cta/90 text-cta-foreground py-2 md:py-2.5 rounded-lg text-[11px] md:text-sm font-semibold hover:opacity-90 transition-all">
                      {t("Buy Now", "अभी खरीदें")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TopSellingProducts;
