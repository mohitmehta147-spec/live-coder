import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

const MediaLogos = () => {
  const [logos, setLogos] = useState<any[]>([]);
  const [enabled, setEnabled] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const fetch = async () => {
      const [{ data: settings }, { data }] = await Promise.all([
        supabase.from("site_settings").select("value").eq("key", "section_media_enabled").single(),
        supabase.from("media_logos").select("*").eq("is_active", true).order("sort_order"),
      ]);
      if (settings?.value === "false") setEnabled(false);
      setLogos(data || []);
    };
    fetch();
  }, []);

  if (!enabled || logos.length === 0) return null;

  // Double the logos for seamless infinite scroll
  const scrollLogos = [...logos, ...logos];

  return (
    <section className="py-12 bg-linear-to-br from-orange-50 via-amber-50/40 to-rose-50 border-y border-orange-100/60 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <span className="inline-block text-[11px] font-bold tracking-[0.25em] uppercase bg-linear-to-r from-orange-600 to-rose-600 bg-clip-text text-transparent mb-1">
            {t("Featured In", "मीडिया में")}
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">
            {t("As Seen In", "मीडिया में")}
          </h2>
        </div>
      </div>
      <div className="relative w-full">
        <div className="absolute left-0 top-0 bottom-0 w-16 md:w-24 bg-linear-to-r from-orange-50 to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-16 md:w-24 bg-linear-to-l from-rose-50 to-transparent z-10" />

        <div className="flex animate-marquee hover:[animation-play-state:paused] items-center gap-6 md:gap-10 w-max">
          {scrollLogos.map((logo, i) => (
            <a
              key={`${logo.id}-${i}`}
              href={logo.link || "#"}
              target={logo.link ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="group shrink-0 bg-white rounded-2xl px-6 py-4 md:px-8 md:py-5 shadow-md hover:shadow-xl ring-1 ring-orange-100 hover:ring-orange-300 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center"
            >
              {logo.image_url ? (
                <img loading="lazy" decoding="async"
                  src={logo.image_url}
                  alt={logo.name}
                  className="h-14 md:h-20 w-auto max-w-[180px] md:max-w-[240px] object-contain"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                    const sibling = target.nextElementSibling as HTMLElement;
                    if (sibling) sibling.style.display = "block";
                  }}
                />
              ) : null}
              <span
                className={`text-xl md:text-2xl font-extrabold bg-linear-to-r from-orange-600 via-rose-600 to-pink-600 bg-clip-text text-transparent whitespace-nowrap ${logo.image_url ? "hidden" : "block"}`}
              >
                {logo.name}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MediaLogos;
