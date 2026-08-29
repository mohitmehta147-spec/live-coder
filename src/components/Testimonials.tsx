import { useEffect, useState } from "react";
import { Star, Quote } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";

type Item = { id: string; name: string; role: string | null; location: string | null; rating: number | null; content: string; content_hi: string | null; image_url: string | null };

const fallback: Item[] = [
  { id: "1", name: "Rahul Sharma", role: null, location: "Delhi", rating: 5, content: "Ashwagandha capsules have truly changed my life. I feel more energetic and my stress levels have reduced significantly.", content_hi: "अश्वगंधा कैप्सूल ने सच में मेरी जिंदगी बदल दी।", image_url: null },
  { id: "2", name: "Priya Patel", role: null, location: "Mumbai", rating: 5, content: "The PCOS Care Kit worked wonders for me. After 3 months of regular use, my hormonal balance has improved.", content_hi: "PCOS केयर किट ने मेरे लिए चमत्कार किया।", image_url: null },
  { id: "3", name: "Amit Kumar", role: null, location: "Bangalore", rating: 5, content: "Shilajit Gold Resin is premium quality. Great results in stamina and vitality!", content_hi: "शिलाजीत गोल्ड रेसिन प्रीमियम क्वालिटी का है।", image_url: null },
];

const Testimonials = () => {
  const { t, lang } = useLanguage();
  const [items, setItems] = useState<Item[]>(fallback);

  useEffect(() => {
    (supabase as any).from("testimonials").select("*").eq("is_active", true).order("sort_order").then(({ data }: any) => {
      if (data && data.length) setItems(data);
    });
  }, []);

  return (
    <section className="py-6 md:py-16 bg-linear-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-5 md:mb-10">
          <h2 className="text-xl md:text-3xl font-bold text-foreground mb-2">
            {t("💬 What Our Customers Say", "💬 हमारे ग्राहक क्या कहते हैं")}
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            {t("Trusted by 20 Lakh+ happy customers across India", "पूरे भारत में 20 लाख+ खुश ग्राहकों का भरोसा")}
          </p>
          <div className="flex items-center justify-center gap-1 mt-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="h-5 w-5 fill-cta text-cta" />
            ))}
            <span className="ml-2 text-sm font-semibold text-foreground">4.8/5</span>
            <span className="text-xs text-muted-foreground ml-1">(12,000+ reviews)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {items.map((item) => {
            const txt = lang === "hi" && item.content_hi ? item.content_hi : item.content;
            const initials = item.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
            return (
              <div key={item.id} className="bg-card rounded-2xl border border-border p-5 md:p-6 relative group hover:shadow-lg hover:border-primary/20 transition-all duration-300">
                <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/10 group-hover:text-primary/20 transition-colors" />
                <div className="flex items-center gap-3 mb-4">
                  {item.image_url ? (
                    <img loading="lazy" decoding="async" src={item.image_url} alt={item.name} className="w-11 h-11 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-linear-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">{initials}</div>
                  )}
                  <div>
                    <p className="font-semibold text-sm text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.role || item.location}</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-3.5 w-3.5 ${i < (item.rating || 5) ? "fill-cta text-cta" : "text-border"}`} />
                  ))}
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed line-clamp-5">"{txt}"</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
export default Testimonials;
