import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Star, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { withPackPrices, inCategory } from "@/lib/pricing";
import { fetchCategories, concernCategories, type Category } from "@/hooks/use-categories";

type Product = {
  id: string; name: string; name_hi: string | null; slug: string;
  price: number; mrp: number; rating: number | null; reviews_count: number | null;
  image_url: string | null; badge: string | null; category_id: string | null;
  short_description?: string | null;
};

const ConcernProducts = () => {
  const [activeId, setActiveId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const { t, lang } = useLanguage();
  const { addToCart } = useCart();

  useEffect(() => {
    const loadData = async () => {
      const [cats, { data: productsData }] = await Promise.all([
        fetchCategories(true),
        supabase.from("products").select("id,name,name_hi,slug,price,mrp,rating,reviews_count,image_url,badge,category_id,category_ids,variations,short_description").eq("is_active", true).order("sort_order"),
      ]);
      setCategories(cats);
      if (productsData) setProducts(withPackPrices(productsData) as Product[]);
    };
    loadData();
  }, []);

  // Admin controlled: only categories with "Show in Shop By Concern" = ON,
  // in the admin-defined display order, that actually have products assigned.
  const tabs = useMemo(() => {
    const hasProducts = (c: Category) => products.some((p) => inCategory(p, c.id));
    const flagged = concernCategories(categories);
    const withProducts = flagged.filter(hasProducts);
    if (withProducts.length) return withProducts;
    // Fallbacks so the section is never empty:
    const anyWithProducts = categories.filter(hasProducts);
    if (anyWithProducts.length) return anyWithProducts.slice(0, 15);
    if (flagged.length) return flagged.slice(0, 15);
    return categories.filter((c) => !c.parent_id).slice(0, 15);
  }, [categories, products]);

  useEffect(() => {
    if (tabs.length && !tabs.some((c) => c.id === activeId)) setActiveId(tabs[0].id);
  }, [tabs, activeId]);


  const activeCategory = tabs.find((c) => c.id === activeId) || tabs[0];
  const currentProducts = useMemo(() => {
    if (!activeCategory) return [];
    const matched = products.filter((p) => inCategory(p, activeCategory.id));
    // If no product is mapped to this category yet, still show products instead of a blank section
    return (matched.length ? matched : products).slice(0, 8);
  }, [activeCategory, products]);

  const catName = (c?: Category) => (c ? (lang === "hi" && c.name_hi ? c.name_hi : c.name) : "");

  if (tabs.length === 0 || products.length === 0) return null;

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5 md:mb-7">
          <div>
            <h2 className="text-2xl md:text-4xl font-extrabold text-primary leading-tight">
              {t("Shop By ", "खरीदें ")}
              <span className="italic text-cta">{t("Concern?", "समस्या अनुसार?")}</span>
            </h2>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              {t("Browse products by your health need", "अपनी स्वास्थ्य ज़रूरत के अनुसार उत्पाद देखें")}
            </p>
          </div>
          <Link
            to="/products"
            className="shrink-0 hidden sm:inline-flex items-center gap-2 rounded-full border-2 border-primary px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition"
          >
            {t("View All", "सब देखें")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Pills */}
        <div className="flex gap-2.5 md:gap-3 overflow-x-auto pb-2 scrollbar-hide mb-6">
          {tabs.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`px-4 md:px-6 py-2 md:py-2.5 rounded-full border-2 text-xs md:text-sm font-semibold whitespace-nowrap shrink-0 transition-all ${
                activeCategory?.id === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/25 bg-card text-primary hover:border-primary"
              }`}
            >
              {catName(c)}
            </button>
          ))}
        </div>

        {/* Products */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {currentProducts.map((p) => {
            const discount = p['mrp'] > 0 ? Math.round(((p['mrp'] - p['price']) / p['mrp']) * 100) : 0;
            const name = lang === "hi" && p.name_hi ? p.name_hi : p.name;
            return (
              <div key={p.id} className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-xl transition-all group">
                <Link to="/product/$slug" params={{ slug: p.slug }}>
                  <div className="bg-muted aspect-square flex items-center justify-center relative overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <span className="text-5xl group-hover:scale-110 transition-transform">🌿</span>
                    )}
                    {discount > 0 && (
                      <span className="absolute top-2 left-2 bg-cta text-cta-foreground text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-lg shadow-sm">{discount}% OFF</span>
                    )}
                    {p.badge && (
                      <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-lg shadow-sm">{p.badge}</span>
                    )}
                  </div>
                </Link>
                <div className="p-3 md:p-4">
                  <div className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-cta mb-1">
                    {catName(activeCategory)}
                  </div>
                  <Link to="/product/$slug" params={{ slug: p.slug }}>
                    <h3 className="font-bold text-sm md:text-base text-primary mb-1 line-clamp-2 hover:opacity-80 transition">{name}</h3>
                  </Link>
                  {p.short_description && (
                    <p className="text-[11px] md:text-xs text-muted-foreground line-clamp-2 mb-1.5">{p.short_description}</p>
                  )}
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
                      className="flex-1 flex items-center justify-center gap-1 bg-primary text-primary-foreground py-2 md:py-2.5 rounded-lg md:rounded-xl text-[11px] md:text-sm font-semibold hover:opacity-90 transition">
                      <ShoppingCart className="h-3 w-3 md:h-3.5 md:w-3.5 hidden md:block shrink-0" /> {t("Add to Cart", "कार्ट में डालें")}
                    </button>
                    <Link to="/product/$slug" params={{ slug: p.slug }}
                      className="flex-1 text-center bg-cta hover:bg-cta/90 text-cta-foreground py-2 md:py-2.5 rounded-lg md:rounded-xl text-[11px] md:text-sm font-semibold hover:opacity-90 transition">
                      {t("Buy Now", "अभी खरीदें")}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sm:hidden mt-5 text-center">
          <Link to="/products" className="inline-flex items-center gap-2 rounded-full border-2 border-primary px-5 py-2.5 text-sm font-semibold text-primary">
            {t("View All", "सब देखें")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ConcernProducts;
