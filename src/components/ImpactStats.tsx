import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import CountUp from "@/components/CountUp";


const ImpactStats = () => {
  const [stats, setStats] = useState<any[]>([]);
  const [enabled, setEnabled] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const fetch = async () => {
      const [{ data: settings }, { data }] = await Promise.all([
        supabase.from("site_settings").select("value").eq("key", "section_impact_enabled").single(),
        supabase.from("impact_stats").select("*").eq("is_active", true).order("sort_order"),
      ]);
      if (settings?.value === "false") setEnabled(false);
      setStats(data || []);
    };
    fetch();
  }, []);

  if (!enabled || stats.length === 0) return null;

  return (
    <section className="py-10 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-xl md:text-2xl font-bold text-foreground text-center mb-8">
          {t("Our Impact", "हमारा प्रभाव")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.id} className="text-center p-4 rounded-xl bg-card border border-border hover:shadow-md transition">
              <div className="text-3xl mb-2">{stat.icon}</div>
              <CountUp value={stat.value} className="text-2xl md:text-3xl font-bold text-primary block" />
              <p className="text-sm text-muted-foreground mt-1">
                {t(stat.label, stat.label_hi || stat.label)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ImpactStats;
