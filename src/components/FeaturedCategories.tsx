import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";

type Category = {
  id: string;
  name: string;
  name_hi: string | null;
  slug: string;
  icon: string | null;
};

const FeaturedCategories = () => {
  const { t, lang } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    supabase
      .from("categories")
      .select("id,name,name_hi,slug,icon")
      .eq("is_active", true)
      .order("sort_order")
      .limit(8)
      .then(({ data }) => setCategories((data || []) as Category[]));
  }, []);

  return (
    <section className="py-12 md:py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              {t("Featured Categories", "लोकप्रिय श्रेणियाँ")}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {t("Browse by health concern", "स्वास्थ्य समस्या के अनुसार खोजें")}
            </p>
          </div>
          <Link to="/products" className="text-primary font-semibold text-sm hover:underline">
            {t("Shop all →", "सब देखें →")}
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {categories.map((category) => {
            return (
              <Link key={category.id} to="/products" className="group flex flex-col items-center gap-3 p-6 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform text-xl">
                  {category.icon || "🌿"}
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm text-foreground">{lang === "hi" && category.name_hi ? category.name_hi : category.name}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturedCategories;
