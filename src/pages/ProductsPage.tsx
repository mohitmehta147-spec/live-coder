import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useSearchParams } from "@/hooks/use-search-params";
import { ShoppingCart, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useDiscountedProducts } from "@/hooks/use-countdown-discount";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { withPackPrices, inCategory } from "@/lib/pricing";

type Product = {
  id: string; name: string; name_hi: string | null; slug: string; price: number; mrp: number;
  rating: number | null; reviews_count: number | null; image_url: string | null; badge: string | null;
  category_id: string | null;
};

type Category = { id: string; name: string; name_hi: string | null; slug: string; parent_id: string | null };

const ProductsPage = () => {
  const [rawProducts, setProducts] = useState<Product[]>([]);
  const products = useDiscountedProducts(rawProducts) as Product[];
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, lang } = useLanguage();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categorySlug = searchParams.get("category") || "";

  useEffect(() => {
    (async () => {
      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase.from("products")
          .select("id,name,name_hi,slug,price,mrp,rating,reviews_count,image_url,badge,category_id,category_ids,variations")
          .eq("is_active", true).order("sort_order"),
        supabase.from("categories").select("id,name,name_hi,slug,parent_id").eq("is_active", true),
      ]);
      if (prods) setProducts(withPackPrices(prods) as Product[]);
      setCategories((cats || []) as Category[]);
      setLoading(false);
    })();
  }, []);

  const activeCategory = useMemo(
    () => categories.find(c => c.slug === categorySlug),
    [categories, categorySlug]
  );

  const filteredProducts = useMemo(() => {
    if (!activeCategory) return products;
    // Include products from all child categories when a parent (top-level) category is selected
    const childIds = categories.filter(c => c.parent_id === activeCategory.id).map(c => c.id);
    const allowed = new Set<string>([activeCategory.id, ...childIds]);
    return products.filter(p => Array.from(allowed).some(cid => inCategory(p, cid as string)));
  }, [products, activeCategory, categories]);

  return (
    <div className="min-h-screen bg-background">
      <TopBar /><SiteHeader />
      <div className="container mx-auto px-4 py-6 md:py-10">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          {activeCategory
            ? (lang === "hi" && activeCategory.name_hi ? activeCategory.name_hi : activeCategory.name)
            : t("All Products", "सभी उत्पाद")}
        </h1>
        {activeCategory && (
          <Link to="/products" className="text-sm text-primary hover:underline inline-block mb-4">
            ← {t("View All Products", "सभी उत्पाद देखें")}
          </Link>
        )}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-64 bg-muted rounded-2xl animate-pulse" />)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center">{t("No products in this category yet.", "इस श्रेणी में अभी कोई उत्पाद नहीं है।")}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
            {filteredProducts.map((p) => {
              const discount = p['mrp'] > 0 ? Math.round(((p['mrp'] - p['price']) / p['mrp']) * 100) : 0;
              const name = lang === "hi" && p.name_hi ? p.name_hi : p.name;
              return (
                <div key={p.id} className="product-card group">
                  <Link to="/product/$slug" params={{ slug: p.slug }}>
                    <div className="bg-muted aspect-square flex items-center justify-center relative overflow-hidden">
                      {p.image_url ? (
                        <img src={p.image_url} alt={name} loading="lazy"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.parentElement!.querySelector('.img-fallback') as HTMLElement).style.display = 'flex'; }}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : null}
                      <span className="img-fallback absolute inset-0 items-center justify-center text-5xl" style={{ display: p.image_url ? 'none' : 'flex' }}>🌿</span>
                      {discount > 0 && (
                        <span className="absolute top-2 left-2 text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-lg shadow-sm" style={{background: 'linear-gradient(135deg, hsl(0 84% 55%), hsl(15 90% 50%))', color: 'white'}}>{discount}% OFF</span>
                      )}
                      {p.badge && (
                        <span className="absolute top-2 right-2 text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-lg shadow-sm bg-primary text-primary-foreground">{p.badge}</span>
                      )}
                    </div>
                  </Link>
                  <div className="p-3 md:p-4">
                    <Link to="/product/$slug" params={{ slug: p.slug }}>
                      <h3 className="font-semibold text-sm md:text-base text-foreground mb-1.5 line-clamp-2 hover:text-primary transition">{name}</h3>
                    </Link>
                    {p.rating && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                          <Star className="h-3 w-3 fill-current" /> {p.rating}
                        </span>
                        <span className="text-xs text-muted-foreground">({(p.reviews_count || 0).toLocaleString()})</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-bold text-lg md:text-xl text-foreground">₹{p['price']}</span>
                      {p['mrp'] > p['price'] && <span className="text-sm text-muted-foreground line-through">₹{p['mrp']}</span>}
                    </div>
                    <div className="flex gap-1.5 md:gap-2">
                      <button onClick={() => addToCart({ id: p.id, name: p.name, name_hi: p.name_hi, price: p['price'], mrp: p['mrp'], image_url: p.image_url, slug: p.slug })}
                        className="flex-1 flex items-center justify-center gap-1 bg-primary text-primary-foreground py-2 md:py-2.5 rounded-lg md:rounded-xl text-[11px] md:text-sm font-semibold hover:opacity-90 hover:shadow-md transition-all">
                        <ShoppingCart className="h-3 w-3 md:h-3.5 md:w-3.5 hidden md:block shrink-0" /> {t("Add to Cart", "कार्ट में डालें")}
                      </button>
                      <button onClick={() => { addToCart({ id: p.id, name: p.name, name_hi: p.name_hi, price: p['price'], mrp: p['mrp'], image_url: p.image_url, slug: p.slug }); navigate({ to: "/checkout" }); }}
                        className="flex-1 text-center bg-cta hover:bg-cta/90 text-cta-foreground py-2 md:py-2.5 rounded-lg md:rounded-xl text-[11px] md:text-sm font-semibold hover:opacity-90 hover:shadow-md transition-all">
                        {t("Buy Now", "अभी खरीदें")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
};

export default ProductsPage;
