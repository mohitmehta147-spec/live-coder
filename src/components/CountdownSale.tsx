import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { Timer, Flame, ArrowRight } from "lucide-react";

const getTargetDay = (saleDay: number) => {
  const now = new Date();
  const day = now.getDay();
  const daysUntil = day === saleDay ? 0 : ((saleDay - day + 7) % 7) || 7;
  const target = new Date(now);
  if (day === saleDay) {
    target.setHours(23, 59, 59, 999);
  } else {
    target.setDate(now.getDate() + daysUntil);
    target.setHours(23, 59, 59, 999);
  }
  return target;
};

type SaleConfig = {
  enabled: boolean;
  title: string; titleHi: string;
  subtitle: string; subtitleHi: string;
  saleDay: number;
  startsAt: string | null;
  endsAt: string | null;
  colorFrom: string; colorVia: string; colorTo: string;
  ctaText: string; ctaTextHi: string;
};

const DEFAULTS: SaleConfig = {
  enabled: true,
  title: "🔥 SUNDAY MEGA SALE", titleHi: "🔥 रविवार मेगा सेल",
  subtitle: "Flat 50% OFF on All Products!", subtitleHi: "सभी उत्पादों पर फ्लैट 50% की छूट!",
  saleDay: 0,
  startsAt: null, endsAt: null,
  colorFrom: "#f59e0b", colorVia: "#f97316", colorTo: "#f43f5e",
  ctaText: "SHOP NOW", ctaTextHi: "अभी खरीदें",
};

const parseDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const CountdownSale = () => {
  const { t, lang } = useLanguage();
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isToday, setIsToday] = useState(false);
  const [hide, setHide] = useState(false);
  const [config, setConfig] = useState<SaleConfig>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      const { data } = await supabase.from("site_settings").select("key, value").like("key", "countdown_%");
      if (data && data.length > 0) {
        const m: Record<string, string> = {};
        data.forEach((s: any) => { m[s.key] = s.value || ""; });
        // Validate dates — fall back to discount window if sale fields are invalid/empty
        const saleStart = parseDate(m["countdown_sale_starts_at"]);
        const saleEnd = parseDate(m["countdown_sale_ends_at"]);
        const discStart = parseDate(m["countdown_discount_starts_at"]);
        const discEnd = parseDate(m["countdown_discount_ends_at"]);
        const startsAt = saleStart ? saleStart.toISOString() : (discStart ? discStart.toISOString() : null);
        const endsAt = saleEnd ? saleEnd.toISOString() : (discEnd ? discEnd.toISOString() : null);
        // Banner enabled by default unless explicitly set to "false"
        const explicitFlag = m["countdown_enabled"] ?? m["countdown_sale_enabled"];
        const enabled = explicitFlag === undefined ? true : explicitFlag !== "false";
        const saleDayRaw = parseInt(m["countdown_sale_day"] || "0");
        const saleDay = (!isNaN(saleDayRaw) && saleDayRaw >= 0 && saleDayRaw <= 6) ? saleDayRaw : 0;
        setConfig({
          enabled,
          title: m["countdown_sale_title"] || DEFAULTS.title,
          titleHi: m["countdown_sale_title_hi"] || DEFAULTS.titleHi,
          subtitle: m["countdown_sale_subtitle"] || DEFAULTS.subtitle,
          subtitleHi: m["countdown_sale_subtitle_hi"] || DEFAULTS.subtitleHi,
          saleDay,
          startsAt,
          endsAt,
          colorFrom: m["countdown_sale_color_from"] || DEFAULTS.colorFrom,
          colorVia: m["countdown_sale_color_via"] || DEFAULTS.colorVia,
          colorTo: m["countdown_sale_color_to"] || DEFAULTS.colorTo,
          ctaText: m["countdown_sale_cta_text"] || DEFAULTS.ctaText,
          ctaTextHi: m["countdown_sale_cta_text_hi"] || DEFAULTS.ctaTextHi,
        });
      }
      setLoaded(true);
    };
    loadConfig();
    const onRefresh = () => loadConfig();
    window.addEventListener("countdown-sale-updated", onRefresh);
    return () => window.removeEventListener("countdown-sale-updated", onRefresh);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const hasExact = !!(config.startsAt || config.endsAt);
    const update = () => {
      const now = new Date();
      let target: Date;
      let active = false;
      let endedExact = false;
      if (hasExact) {
        const start = config.startsAt ? new Date(config.startsAt) : null;
        const end = config.endsAt ? new Date(config.endsAt) : null;
        active = (!start || now >= start) && (!end || now <= end);
        endedExact = !!(end && now > end);
        target = end || start || now;
      } else {
        active = now.getDay() === config.saleDay;
        target = getTargetDay(config.saleDay);
      }
      setIsToday(active);
      setHide(endedExact);
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [loaded, config.saleDay, config.startsAt, config.endsAt]);

  if (!loaded || !config.enabled || hide) return null;

  const title = lang === "hi" ? config.titleHi : config.title;
  const subtitle = lang === "hi" ? config.subtitleHi : config.subtitle;
  const ctaText = lang === "hi" ? config.ctaTextHi : config.ctaText;

  const TimeBox = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="bg-foreground text-background font-black text-xl md:text-3xl rounded-xl w-14 h-14 md:w-16 md:h-16 flex items-center justify-center tabular-nums shadow-lg">
        {String(value).padStart(2, "0")}
      </div>
      <span className="text-[10px] md:text-xs mt-1.5 font-medium opacity-90">{label}</span>
    </div>
  );

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${config.colorFrom}, ${config.colorVia}, ${config.colorTo})` }} />
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />

      <div className="container mx-auto px-4 py-3 md:py-3.5 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-8">
          <div className="flex items-center gap-3 text-center md:text-left">
            <div className="hidden md:flex items-center justify-center w-10 h-10 bg-white/20 rounded-full backdrop-blur-sm">
              <Flame className="h-5 w-5 text-white" />
            </div>
            <div className="text-white">
              <h3 className="font-black text-base md:text-lg tracking-tight leading-tight">
                {isToday ? `${title} LIVE!` : title}
              </h3>
              <p className="text-xs md:text-sm font-semibold opacity-95">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 text-white">
            <Timer className="h-4 w-4 hidden md:block opacity-80" />
            {isToday && !config.endsAt ? (
              <span className="text-base font-bold bg-white/20 backdrop-blur-sm px-5 py-2.5 rounded-xl animate-pulse border border-white/30">
                {t("OFFER ENDS TODAY!", "ऑफ़र आज समाप्त!")}
              </span>
            ) : (
              <>
                <TimeBox value={timeLeft.days} label={t("Days", "दिन")} />
                <span className="text-2xl md:text-3xl font-black opacity-60 -mx-0.5">:</span>
                <TimeBox value={timeLeft.hours} label={t("Hrs", "घंटे")} />
                <span className="text-2xl md:text-3xl font-black opacity-60 -mx-0.5">:</span>
                <TimeBox value={timeLeft.minutes} label={t("Min", "मिनट")} />
                <span className="text-2xl md:text-3xl font-black opacity-60 -mx-0.5">:</span>
                <TimeBox value={timeLeft.seconds} label={t("Sec", "सेकंड")} />
              </>
            )}
          </div>

          <a href="/products" className="group flex items-center gap-2 bg-foreground text-background px-6 py-2.5 rounded-full font-bold text-sm hover:scale-105 transition-all shadow-xl hover:shadow-2xl shrink-0">
            {ctaText}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default CountdownSale;
