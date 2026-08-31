import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import heroBanner1 from "@/assets/hero-banner-1.jpg";
import heroBanner2 from "@/assets/hero-banner-2.jpg";
import heroBanner3 from "@/assets/hero-banner-3.jpg";

type Slide = {
  title: string;
  titleHi?: string;
  desc?: string;
  descHi?: string;
  cta?: string;
  ctaHi?: string;
  ctaLink?: string;
  image: string;
  imageMobile?: string | null;
  mobileHeight?: string | null;
  bgColor?: string | null;
};

const defaultSlides: Slide[] = [
  { title: "Consult Trusted Ayurvedic Doctors", titleHi: "विश्वसनीय आयुर्वेदिक डॉक्टर से परामर्श करें", desc: "Get expert advice for your health concerns from certified practitioners.", descHi: "प्रमाणित चिकित्सकों से अपनी स्वास्थ्य समस्याओं के लिए विशेषज्ञ सलाह प्राप्त करें।", cta: "Book Free Consultation", ctaHi: "मुफ्त परामर्श बुक करें", ctaLink: "/consultation", image: heroBanner1 },
  { title: "100% Authentic Ayurvedic Products", titleHi: "100% प्रामाणिक आयुर्वेदिक उत्पाद", desc: "Clinically tested, FSSAI approved. Trusted by 20 Lakh+ customers.", descHi: "चिकित्सकीय रूप से परीक्षित, FSSAI अनुमोदित। 20 लाख+ ग्राहकों का भरोसा।", cta: "Shop Now", ctaHi: "अभी खरीदें", ctaLink: "/products", image: heroBanner2 },
  { title: "Buy 2 Get 1 Free on All Juices", titleHi: "सभी जूस पर 2 खरीदें 1 मुफ्त पाएं", desc: "Limited time offer on our bestselling Ayurvedic juices.", descHi: "हमारे बेस्टसेलिंग आयुर्वेदिक जूस पर सीमित समय का ऑफर।", cta: "View Offers", ctaHi: "ऑफर देखें", ctaLink: "/products", image: heroBanner3 },
];

const HeroBanner = () => {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [current, setCurrent] = useState(0);
  const { t } = useLanguage();

  useEffect(() => {
    supabase.from("banners").select("*").eq("section", "hero").eq("is_active", true).order("sort_order").then(({ data }) => {
      if (data && data.length > 0) {
        setSlides(data.map((b: any) => ({
          title: b.title,
          titleHi: b.title,
          desc: b.subtitle || "",
          descHi: b.subtitle || "",
          cta: b.cta_text || "",
          ctaHi: b.cta_text || "",
          ctaLink: b.cta_link || "/products",
          image: b.image_url || heroBanner1,
          imageMobile: b.image_url_mobile || null,
          mobileHeight: b.mobile_height || "auto",
          bgColor: b.bg_color,
        })));
      } else {
        setSlides(defaultSlides);
      }
      setCurrent(0);
    });
  }, []);

  useEffect(() => {
    if (!slides || slides.length <= 1) return;
    const timer = setInterval(() => setCurrent((p) => (p + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [slides]);

  // Swipe support: left swipe = next slide, right swipe = previous slide
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0]?.clientX ?? null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !slides || slides.length <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) setCurrent((p) => (p + 1) % slides.length);
    else setCurrent((p) => (p - 1 + slides.length) % slides.length);
  };

  if (!slides) return <div className="w-full aspect-[4/3] md:aspect-auto md:min-h-[440px] bg-muted animate-pulse" aria-hidden />;
  const slide = slides[current] || slides[0];
  if (!slide) return null;

  return (
    <section
      className="relative overflow-hidden"
      aria-label="Hero banner"
      style={slide.bgColor ? { backgroundColor: slide.bgColor } : undefined}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Mobile: a proper tall frame so wide desktop art never looks like a thin strip.
          When a dedicated mobile image is uploaded it is shown at its own ratio. */}
      <div className="md:hidden px-3 pt-3 pb-2">
        <a href={slide.ctaLink || "/products"} className="block rounded-2xl overflow-hidden shadow-md relative">
          {(() => {
            const ratio: Record<string, string> = { square: "aspect-square", tall: "aspect-[4/5]", portrait: "aspect-[3/4]", short: "aspect-video" };
            const cls = ratio[slide.mobileHeight || "auto"] || "aspect-[4/5]";
            const src = slide.imageMobile || slide.image;
            return (
              <img
                src={src}
                alt={slide.title || "Banner"}
                loading="eager"
                decoding="async"
                onError={(e) => {
                  const img = e.currentTarget;
                  const step = img.dataset['fb'] || "0";
                  if (step === "0" && slide.imageMobile && slide.image && slide.image !== slide.imageMobile) {
                    img.dataset['fb'] = "1";
                    img.src = slide.image;
                  } else if (step !== "2") {
                    img.dataset['fb'] = "2";
                    img.src = heroBanner1;
                  }
                }}
                className={`w-full ${cls} object-cover object-center block bg-muted`}
              />
            );
          })()}
          {((slide.title && slide.title !== "Untitled") || slide.cta) && (
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/65 to-transparent px-4 pt-10 pb-4">
              {slide.title && slide.title !== "Untitled" && (
                <h2 className="text-white text-lg font-extrabold leading-snug drop-shadow">
                  {t(slide.title, slide.titleHi || slide.title)}
                </h2>
              )}
              {slide.cta && (
                <span className="inline-flex items-center gap-1 mt-2 bg-cta text-cta-foreground px-4 py-2 rounded-full text-xs font-bold">
                  {t(slide.cta, slide.ctaHi || slide.cta)} <ChevronRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          )}
        </a>
      </div>

      {/* Desktop: contained, rounded premium banner card (does not touch screen edges) */}
      <div className="hidden md:block px-4 lg:px-5 pt-5 pb-7">
        <div className="container mx-auto px-0 relative">
          <div className="relative overflow-hidden rounded-[20px] shadow-[0_10px_30px_-12px_color-mix(in_oklab,var(--foreground)_28%,transparent)] ring-1 ring-border/60 bg-muted aspect-[2.45/1] max-h-[560px]">
            <img loading="eager" fetchPriority="high" decoding="async"
              src={slide.image}
              alt={slide.title && slide.title !== "Untitled" ? slide.title : "Banner"}
              className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.dataset['fb'] !== "1") { img.dataset['fb'] = "1"; img.src = heroBanner1; }
              }}
              width={1920}
              height={780}
            />
            {((slide.title && slide.title !== "Untitled") || slide.desc || slide.cta) && (
              <div className="absolute inset-0 bg-linear-to-r from-foreground/65 via-foreground/25 to-transparent" />
            )}

            <div className="relative z-10 h-full flex items-center">
              <div className="max-w-xl pl-10 lg:pl-14 pr-6 animate-fade-in">
                {slide.title && slide.title !== "Untitled" && (
                  <h2 className="text-3xl lg:text-[2.6rem] font-bold text-primary-foreground leading-tight mb-3 drop-shadow-lg">
                    {t(slide.title, slide.titleHi || slide.title)}
                  </h2>
                )}
                {slide.desc && (
                  <p className="text-primary-foreground/85 text-sm lg:text-base mb-6 max-w-md drop-shadow">
                    {t(slide.desc, slide.descHi || slide.desc)}
                  </p>
                )}
                {slide.cta && (
                  <a href={slide.ctaLink || "/products"} className="inline-flex items-center gap-2 bg-cta text-cta-foreground px-7 py-3 rounded-full font-semibold text-sm hover:scale-105 hover:shadow-xl transition-all duration-300 shadow-lg">
                    {t(slide.cta, slide.ctaHi || slide.cta)}
                    <ChevronRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>

            {slides.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                {slides.map((_, i) => (
                  <button key={i} onClick={() => setCurrent(i)} className={`h-2 rounded-full transition-all duration-300 ${i === current ? "bg-cta w-7" : "bg-primary-foreground/50 w-2 hover:bg-primary-foreground/70"}`} aria-label={`Go to slide ${i + 1}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile dots */}
      {slides.length > 1 && (
        <div className="md:hidden">
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} className={`h-2.5 rounded-full transition-all duration-300 ${i === current ? "bg-cta w-8 shadow-md" : "bg-primary-foreground/40 w-2.5 hover:bg-primary-foreground/60"}`} aria-label={`Go to slide ${i + 1}`} />
            ))}
          </div>
        </div>
      )}

    </section>
  );
};

export default HeroBanner;
