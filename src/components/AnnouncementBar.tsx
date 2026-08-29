import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { X } from "lucide-react";

type Announcement = { id: string; message: string; message_hi: string | null; link: string | null; bg_color: string | null; text_color: string | null };

const AnnouncementBar = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [hidden, setHidden] = useState(false);
  const { lang } = useLanguage();

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("announcement_dismissed") === "1") {
      setHidden(true);
      return;
    }
    const now = new Date().toISOString();
    (supabase as any).from("announcements").select("id, message, message_hi, link, bg_color, text_color, starts_at, ends_at")
      .eq("is_active", true).order("sort_order").then(({ data }: any) => {
        const filtered = (data || []).filter((a: any) =>
          (!a.starts_at || a.starts_at <= now) && (!a.ends_at || a.ends_at >= now)
        );
        setItems(filtered);
      });
  }, []);

  if (hidden || items.length === 0) return null;

  // Repeat items enough times to overflow viewport; two identical halves for seamless loop
  const baseRepeat = [...items, ...items, ...items, ...items];
  const bg = items[0].bg_color || "#0F172A";
  const fg = items[0].text_color || "#FFFFFF";

  const renderGroup = (keyPrefix: string) =>
    baseRepeat.map((a, i) => {
      const msg = lang === "hi" && a.message_hi ? a.message_hi : a.message;
      const node = (
        <span className="font-semibold inline-flex items-center gap-2 px-6 border-l border-dashed border-current/40">
          {msg}
        </span>
      );
      return (
        <span key={`${keyPrefix}-${a.id}-${i}`} className="inline-flex shrink-0">
          {a.link ? <a href={a.link} className="hover:underline">{node}</a> : node}
        </span>
      );
    });

  return (
    <div className="relative overflow-hidden text-xs sm:text-sm py-2 pr-8" style={{ background: bg, color: fg }}>
      <div className="flex whitespace-nowrap animate-marquee w-max">
        <div className="flex shrink-0">{renderGroup("a")}</div>
        <div className="flex shrink-0" aria-hidden="true">{renderGroup("b")}</div>
      </div>
      <button onClick={() => { setHidden(true); try { sessionStorage.setItem("announcement_dismissed", "1"); } catch {} }}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 z-10" aria-label="Dismiss" style={{ color: fg }}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
export default AnnouncementBar;
