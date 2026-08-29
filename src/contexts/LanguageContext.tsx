import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type Language = "en" | "hi" | "mr" | "bn" | "ta";

type LanguageContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (en: string, hi?: string) => string;
  languages: { code: Language; label: string; nativeLabel: string }[];
  isLanguageSelected: boolean;
  markLanguageSelected: () => void;
};

const languages: { code: Language; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिंदी" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
];

const translations: Record<Exclude<Language, "en" | "hi">, Record<string, string>> = {
  mr: {
    "Ayurvedic Healthcare": "आयुर्वेदिक आरोग्यसेवा",
    "Search medicines, health problems, doctors...": "औषधे, आरोग्य समस्या, डॉक्टर शोधा...",
    "Buy Now": "आता खरेदी करा",
    Cart: "कार्ट",
    "All Products": "सर्व उत्पादने",
    "Select Concern": "समस्या निवडा",
    "Book Free Appointment": "मोफत अपॉइंटमेंट बुक करा",
    "Doctor Consultation": "डॉक्टर सल्ला",
    "Your Cart": "तुमची कार्ट",
    "Proceed to Checkout": "चेकआउटकडे जा",
    "Free shipping on orders over ₹699": "₹699 पेक्षा जास्त ऑर्डरवर मोफत शिपिंग",
  },
  bn: {
    "Ayurvedic Healthcare": "আয়ুর্বেদিক স্বাস্থ্যসেবা",
    "Search medicines, health problems, doctors...": "ওষুধ, স্বাস্থ্য সমস্যা, ডাক্তার খুঁজুন...",
    "Buy Now": "এখনই কিনুন",
    Cart: "কার্ট",
    "All Products": "সব পণ্য",
    "Select Concern": "সমস্যা নির্বাচন করুন",
    "Book Free Appointment": "ফ্রি অ্যাপয়েন্টমেন্ট বুক করুন",
    "Doctor Consultation": "ডাক্তার পরামর্শ",
    "Your Cart": "আপনার কার্ট",
    "Proceed to Checkout": "চেকআউটে যান",
    "Free shipping on orders over ₹699": "₹699 এর বেশি অর্ডারে ফ্রি শিপিং",
  },
  ta: {
    "Ayurvedic Healthcare": "ஆயுர்வேத சுகாதாரம்",
    "Search medicines, health problems, doctors...": "மருந்துகள், உடல்நல பிரச்சினைகள், டாக்டர்களை தேடுங்கள்...",
    "Buy Now": "இப்போதே வாங்குங்கள்",
    Cart: "கார்ட்",
    "All Products": "அனைத்து பொருட்கள்",
    "Select Concern": "பிரச்சினையைத் தேர்ந்தெடுக்கவும்",
    "Book Free Appointment": "இலவச நேரம் பதிவு செய்யவும்",
    "Doctor Consultation": "மருத்துவர் ஆலோசனை",
    "Your Cart": "உங்கள் கார்ட்",
    "Proceed to Checkout": "செக்அவுட் செல்லவும்",
    "Free shipping on orders over ₹699": "₹699-க்கு மேற்பட்ட ஆர்டர்களுக்கு இலவச டெலிவரி",
  },
};

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (en) => en,
  languages,
  isLanguageSelected: false,
  markLanguageSelected: () => {},
});

export const useLanguage = () => useContext(LanguageContext);

const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("lang") as Language | null;
  return languages.some((l) => l.code === stored) ? (stored as Language) : "en";
};

const getLanguageSelectionState = () => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("lang_selected") === "true";
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Language>("en");
  const [isLanguageSelected, setIsLanguageSelected] = useState<boolean>(true);

  // Read persisted values after hydration to avoid SSR mismatch
  useEffect(() => {
    setLang(getInitialLanguage());
    setIsLanguageSelected(getLanguageSelectionState());
  }, []);

  const handleSetLang = (l: Language) => {
    setLang(l);
    if (typeof window !== "undefined") {
      localStorage.setItem("lang", l);
    }
  };

  const markLanguageSelected = () => {
    setIsLanguageSelected(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("lang_selected", "true");
    }
  };

  const t = useMemo(
    () =>
      (en: string, hi?: string) => {
        if (lang === "hi") return hi || en;
        if (lang === "en") return en;
        return translations[lang]?.[en] || en;
      },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t, languages, isLanguageSelected, markLanguageSelected }}>
      {children}
    </LanguageContext.Provider>
  );
};