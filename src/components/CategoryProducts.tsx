import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingCart, Star, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useDiscountedProducts } from "@/hooks/use-countdown-discount";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { withPackPrices, inCategory } from "@/lib/pricing";

type Category = { id: string; name: string; name_hi: string | null; slug: string; icon: string | null };
type Product = {
  id: string; name: string; name_hi: string | null; slug: string;
  price: number; mrp: number; rating: number | null; reviews_count: number | null;
  image_url: string | null; badge: string | null; category_id: string | null;
};

const CategoryProducts = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rawProducts, setProducts] = useState<Product[]>([]);
  const products = useDiscountedProducts(rawProducts) as Product[];
  const { t, lang } = useLanguage();
  const { addToCart } = useCart();

  useEffect(() => {
    const load = async () => {
      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from("categories").select("id,name,name_hi,slug,icon").eq("is_active", true).order("sort_order").limit(4),
        supabase.from("products").select("id,name,name_hi,slug,price,mrp,rating,reviews_count,image_url,badge,category_id,category_ids,variations").eq("is_active", true).order("sort_order"),
      ]);
      setCategories((cats || []) as Category[]);
      setProducts(withPackPrices(prods) as Product[]);
    };
    load();
  }, []);

  if (categories.length === 0) return null;

  return (
    <section className="py-10 md:py-14">
      <div className="container mx-auto px-4">
        <h2 className="text-xl md:text-2xl font-bold text-foreground text-center mb-8">
          {t("🏷️ Shop by Category", "🏷️ श्रेणी के अनुसार खरीदें")}
        </h2>
        <div className="space-y-10">
          {categories.map((cat) => {
            const catProducts = products.filter((p) => inCategory(p, cat.id)).slice(0, 4);
            if (catProducts.length === 0) return null;
            const catName = lang === "hi" && cat.name_hi ? cat.name_hi : cat.name;
            return (
              <div key={cat.id}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <span>{cat.icon || "🌿"}</span> {catName}
                  </h3>
                  <Link to="/products" className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                    {t("See All", "सब देखें")} <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  {catProducts.map((p) => {
                    const discount = p['mrp'] > 0 ? Math.round(((p['mrp'] - p['price']) / p['mrp']) * 100) : 0;
                    const name = lang === "hi" && p.name_hi ? p.name_hi : p.name;
                    return (
                      <div key={p.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition group">
                        <Link to="/product/$slug" params={{ slug: p.slug }}>
                          <div className="bg-muted aspect-square flex items-center justify-center relative overflow-hidden">
                            {p.image_url ? (
                              <img loading="lazy" decoding="async" src={p.image_url} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                            ) : (
                              <span className="text-5xl">🌿</span>
                            )}
                            {discount > 0 && <span className="absolute top-2 left-2 bg-cta text-cta-foreground text-[10px] font-bold px-2 py-0.5 rounded">{discount}% OFF</span>}
                          </div>
                        </Link>
                        <div className="p-3">
                          <Link to="/product/$slug" params={{ slug: p.slug }}>
                            <h3 className="font-medium text-xs md:text-sm text-foreground mb-1 line-clamp-2 hover:text-primary transition">{name}</h3>
                          </Link>
                          {p.rating && (
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                                <Star className="h-3 w-3 fill-current" /> {p.rating}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="font-bold text-sm text-foreground">₹{p['price']}</span>
                            {p['mrp'] > p['price'] && <span className="text-xs text-muted-foreground line-through">₹{p['mrp']}</span>}
                          </div>
                          <div className="mb-2"><ProductCountdown compact product={p} /></div>
                          <button onClick={() => addToCart({ id: p.id, name: p.name, name_hi: p.name_hi, price: p['price'], mrp: p['mrp'], image_url: p.image_url, slug: p.slug })}
                            className="w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground py-2 rounded-lg text-[11px] md:text-xs font-semibold hover:opacity-90 transition">
                            <ShoppingCart className="h-3.5 w-3.5" /> {t("Add to Cart", "कार्ट में डालें")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategoryProducts;
