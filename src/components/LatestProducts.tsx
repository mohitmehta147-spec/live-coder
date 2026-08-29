import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingCart, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { withPackPrices } from "@/lib/pricing";

type Product = {
  id: string; name: string; name_hi: string | null; slug: string;
  price: number; mrp: number; rating: number | null; reviews_count: number | null;
  image_url: string | null; badge: string | null;
};

const LatestProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const { t, lang } = useLanguage();
  const { addToCart } = useCart();

  useEffect(() => {
    supabase.from("products")
      .select("id,name,name_hi,slug,price,mrp,rating,reviews_count,image_url,badge,variations")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setProducts(withPackPrices(data) as Product[]));
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="pt-2 pb-8 md:pt-3 md:pb-12 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4 md:mb-5">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              {t("🆕 Latest Products", "🆕 नवीनतम उत्पाद")}
            </h2>
            <p className="text-muted-foreground text-sm mt-0.5">{t("Recently added to our collection", "हाल ही में हमारे संग्रह में जोड़े गए")}</p>
          </div>
          <Link to="/products" className="text-primary font-semibold text-sm hover:underline shrink-0">
            {t("View All →", "सब देखें →")}
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {products.map((p) => {
            const discount = p['mrp'] > 0 ? Math.round(((p['mrp'] - p['price']) / p['mrp']) * 100) : 0;
            const name = lang === "hi" && p.name_hi ? p.name_hi : p.name;
            return (
              <div key={p.id} className="product-card group">
                <Link to="/product/$slug" params={{ slug: p.slug }}>
                  <div className="bg-muted aspect-square flex items-center justify-center relative overflow-hidden">
                    {p.image_url ? (
                      <img loading="lazy" decoding="async" src={p.image_url} alt={name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <span className="text-5xl">🌿</span>
                    )}
                    {discount > 0 && (
                      <span className="absolute top-2 left-2 text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-lg shadow-sm" style={{background: 'linear-gradient(135deg, hsl(0 84% 55%), hsl(15 90% 50%))', color: 'white'}}>
                        {discount}% OFF
                      </span>
                    )}
                    <span className="absolute top-2 right-2 text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-lg shadow-sm bg-primary text-primary-foreground">
                      {t("New", "नया")}
                    </span>
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
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-bold text-lg md:text-xl text-foreground">₹{p['price']}</span>
                    {p['mrp'] > p['price'] && <span className="text-sm text-muted-foreground line-through">₹{p['mrp']}</span>}
                  </div>
                  <button onClick={() => addToCart({ id: p.id, name: p.name, name_hi: p.name_hi, price: p['price'], mrp: p['mrp'], image_url: p.image_url, slug: p.slug })}
                    className="w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground py-2.5 rounded-xl text-xs md:text-sm font-semibold hover:opacity-90 hover:shadow-md transition-all">
                    <ShoppingCart className="h-3.5 w-3.5" /> {t("Add to Cart", "कार्ट में डालें")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default LatestProducts;
