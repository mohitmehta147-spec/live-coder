import { useEffect, useState } from "react";
import { Truck, ShieldCheck, RefreshCw, Headphones } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";

const icons = [Truck, ShieldCheck, ShieldCheck, Headphones];

const TrustBadges = () => {
  const { t, lang } = useLanguage();
  const [badges, setBadges] = useState([
    { title: "Free Delivery", titleHi: "मुफ्त डिलीवरी", subtitle: "On orders above ₹699", subtitleHi: "₹699 से ऊपर के ऑर्डर पर" },
    { title: "GMP Certified", titleHi: "GMP प्रमाणित", subtitle: "Quality Assured", subtitleHi: "गुणवत्ता आश्वासित" },
    { title: "100% Authentic", titleHi: "100% प्रामाणिक", subtitle: "Certified Ayurvedic", subtitleHi: "प्रमाणित आयुर्वेदिक" },
    { title: "24/7 Support", titleHi: "24/7 सहायता", subtitle: "Dedicated help center", subtitleHi: "समर्पित सहायता केंद्र" },
  ]);

  useEffect(() => {
    const fetchBadges = async () => {
      const { data } = await supabase.from("site_settings").select("key, value").like("key", "trust_badge_%");
      if (!data || data.length === 0) return;
      const map: Record<string, string> = {};
      data.forEach(d => { map[d.key] = d.value || ""; });
      const newBadges = [1, 2, 3, 4].map(i => ({
        title: map[`trust_badge_${i}_title`] || badges[i - 1].title,
        titleHi: map[`trust_badge_${i}_title_hi`] || badges[i - 1].titleHi,
        subtitle: map[`trust_badge_${i}_subtitle`] || badges[i - 1].subtitle,
        subtitleHi: map[`trust_badge_${i}_subtitle_hi`] || badges[i - 1].subtitleHi,
      }));
      setBadges(newBadges);
    };
    fetchBadges();
  }, []);

  return (
    <section className="py-6 md:py-8 border-t border-b border-border">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {badges.map((badge, idx) => {
            const Icon = icons[idx];
            return (
              <div key={idx} className="flex items-center gap-2 md:gap-3">
                <div className="w-9 h-9 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-xs md:text-sm text-foreground truncate">
                    {lang === "hi" ? badge.titleHi : badge.title}
                  </p>
                  <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                    {lang === "hi" ? badge.subtitleHi : badge.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrustBadges;
