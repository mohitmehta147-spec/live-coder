import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const LanguageSelectionPopup = () => {
  const { lang, setLang, languages, isLanguageSelected, markLanguageSelected, t } = useLanguage();
  const [selected, setSelected] = useState(lang);

  if (isLanguageSelected) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-foreground/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-foreground mb-1">{t("Choose your language", "अपनी भाषा चुनें")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("This helps personalize content for you.", "इससे आपकी भाषा में कंटेंट दिखेगा।")}</p>

        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {languages.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() => setSelected(language.code)}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                selected === language.code
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-foreground hover:bg-secondary"
              }`}
            >
              <p className="text-sm font-semibold">{language.nativeLabel}</p>
              <p className="text-xs text-muted-foreground">{language.label}</p>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setLang(selected);
            markLanguageSelected();
          }}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
        >
          {t("Continue", "जारी रखें")}
        </button>
      </div>
    </div>
  );
};

export default LanguageSelectionPopup;