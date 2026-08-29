import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

type Reel = {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url?: string;
  product_slug?: string;
  is_active?: boolean;
};

const ytId = (url: string) => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  return m?.[1] || null;
};
const igId = (url: string) => {
  const m = url.match(/instagram\.com\/(?:reel|p|tv)\/([\w-]+)/);
  return m?.[1] || null;
};

const ReelCard = ({ r, lang, autoplay = false }: { r: Reel; lang: string; autoplay?: boolean }) => {
  const [playing, setPlaying] = useState(autoplay);
  const yt = ytId(r.video_url);
  const ig = igId(r.video_url);
  const isFile = !yt && !ig && r.video_url;

  const body = (
    <div className="relative aspect-[9/16] bg-muted overflow-hidden rounded-2xl">
      {playing && yt ? (
        <div className="w-full h-full relative overflow-hidden">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=${autoplay ? 1 : 0}&playsinline=1&rel=0&modestbranding=1&controls=0&showinfo=0&iv_load_policy=3&loop=1&playlist=${yt}`}
            className="absolute inset-0 w-[130%] h-[130%] -left-[15%] -top-[15%] pointer-events-none"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
          <button onClick={(e) => e.preventDefault()} className="absolute inset-0" aria-label="Reel" />
        </div>
      ) : playing && ig ? (
        <iframe src={`https://www.instagram.com/p/${ig}/embed`} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
      ) : playing && isFile ? (
        <video src={r.video_url} className="w-full h-full object-cover" autoPlay={autoplay} muted={autoplay} loop={autoplay} controls={!autoplay} playsInline />
      ) : (
        <>
          {r.thumbnail_url ? (
            <img src={r.thumbnail_url} alt={r.title} loading="lazy" className="w-full h-full object-cover" />
          ) : yt ? (
            <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt={r.title} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-linear-to-br from-primary/20 to-cta/20 flex items-center justify-center text-5xl">🎬</div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-black/20" />
          <button
            onClick={(e) => { e.preventDefault(); setPlaying(true); }}
            className="absolute inset-0 flex items-center justify-center"
            aria-label="Play reel">
            <span className="w-14 h-14 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-lg hover:scale-110 transition">
              <Play className="h-6 w-6 text-foreground fill-current ml-0.5" />
            </span>
          </button>
          {r.title && (
            <div className="absolute bottom-0 left-0 right-0 p-2.5 text-white">
              <p className="text-xs font-semibold line-clamp-2 leading-tight drop-shadow">{r.title}</p>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (r.product_slug && !playing) {
    return (
      <Link to="/product/$slug" params={{ slug: r.product_slug }} onClick={(e) => e.stopPropagation()} className="snap-start shrink-0 w-[150px] sm:w-[170px] md:w-[200px] block group">
        {body}
      </Link>
    );
  }
  return <div className="snap-start shrink-0 w-[150px] sm:w-[170px] md:w-[200px]">{body}</div>;
};

const ProductReels = ({ slug }: { slug?: string }) => {
  const { t, lang } = useLanguage();
  const [reels, setReels] = useState<Reel[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("key, value").in("key", ["reels_config", "section_reels_enabled"]);
      const cfg = data?.find((r: any) => r.key === "reels_config");
      const en = data?.find((r: any) => r.key === "section_reels_enabled");
      if (en) setEnabled((en.value as any) !== "false" && (en.value as any) !== false);
      if (cfg?.value) {
        try {
          const v = typeof cfg.value === "string" ? JSON.parse(cfg.value) : cfg.value;
          const arr = Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : [];
          setReels(arr.filter((r: Reel) => r.is_active !== false && r.video_url));
        } catch {}
      }
    })();
  }, []);

  // On a product page, only show reels linked to that product's slug.
  const norm = (s?: string) => (s || "").trim().toLowerCase().replace(/^https?:\/\/[^/]+/, "").replace(/^\/?product\//, "").replace(/^\/+|\/+$/g, "");
  const visible = slug ? reels.filter(r => norm(r.product_slug) === norm(slug)) : reels;

  if (!enabled || visible.length === 0) return null;

  return (
    <section className="container mx-auto px-4 mt-4 mb-2">
      <div className="flex gap-3 md:gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
        {visible.map((r) => <ReelCard key={r.id} r={r} lang={lang} autoplay={!!slug} />)}
      </div>
    </section>
  );
};

export default ProductReels;
