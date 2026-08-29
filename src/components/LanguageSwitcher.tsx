import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChevronDown } from "lucide-react";

const LanguageSwitcher = () => {
  const { lang, setLang, languages } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentLang = languages.find(l => l.code === lang);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-secondary transition text-foreground"
        aria-label="Select language"
      >
        <span className="text-base font-bold leading-none">अ</span>
        <span className="text-xs font-semibold text-muted-foreground">/</span>
        <span className="text-sm font-bold leading-none">A</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 min-w-[140px] overflow-hidden">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => { setLang(language.code); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition ${
                lang === language.code
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              <span className="font-bold">{language.nativeLabel}</span>
              <span className="text-xs text-muted-foreground">({language.label})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
