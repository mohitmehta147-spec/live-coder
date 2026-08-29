import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Phone, Stethoscope, ArrowRight, Sparkles, ShieldCheck, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";

type BannerCfg = {
  eyebrow_en: string; eyebrow_hi: string;
  title_en: string; title_hi: string;
  description_en: string; description_hi: string;
  stat1_value: string; stat1_label_en: string; stat1_label_hi: string;
  stat2_value: string; stat2_label_en: string; stat2_label_hi: string;
  stat3_value: string; stat3_label_en: string; stat3_label_hi: string;
  cta_en: string; cta_hi: string;
  phone: string;
  side_title_en: string; side_title_hi: string;
  side_steps_en: string; side_steps_hi: string;
};

export const consultationBannerDefaults: BannerCfg = {
  eyebrow_en: "Doctor Consultation", eyebrow_hi: "डॉक्टर परामर्श",
  title_en: "Consult 3500+ Ayurvedic Doctors — Call & Chat 24/7",
  title_hi: "3500+ आयुर्वेदिक डॉक्टरों से परामर्श — कॉल और चैट 24/7",
  description_en: "Book your free Ayurvedic consultation. Trusted, confidential, and instant care from certified experts.",
  description_hi: "अपना मुफ्त आयुर्वेदिक परामर्श बुक करें। प्रमाणित विशेषज्ञों से भरोसेमंद और तुरंत देखभाल।",
  stat1_value: "50+", stat1_label_en: "Years Experience", stat1_label_hi: "वर्षों का अनुभव",
  stat2_value: "2M+", stat2_label_en: "Patients Treated", stat2_label_hi: "मरीजों का इलाज",
  stat3_value: "1.5M+", stat3_label_en: "Hours Consulted", stat3_label_hi: "परामर्श के घंटे",
  cta_en: "Book Free Appointment", cta_hi: "मुफ्त अपॉइंटमेंट बुक करें",
  phone: "+919876543210",
  side_title_en: "Book in 4 Easy Steps", side_title_hi: "4 आसान चरणों में बुक करें",
  side_steps_en: "Select consultation type|Choose date & time|Fill your details|Upload reports (optional)",
  side_steps_hi: "परामर्श प्रकार चुनें|दिनांक और समय चुनें|अपना विवरण भरें|रिपोर्ट अपलोड करें (वैकल्पिक)",
};

const ConsultationBanner = () => {
  const { t, lang } = useLanguage();
  const [cfg, setCfg] = useState<BannerCfg>(consultationBannerDefaults);

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "consultation_banner").maybeSingle().then(({ data }) => {
      if (data?.value) {
        try { const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value; setCfg({ ...consultationBannerDefaults, ...parsed }); } catch {}
      }
    });
  }, []);

  const stats = [
    { val: cfg.stat1_value, label: t(cfg.stat1_label_en, cfg.stat1_label_hi) },
    { val: cfg.stat2_value, label: t(cfg.stat2_label_en, cfg.stat2_label_hi) },
    { val: cfg.stat3_value, label: t(cfg.stat3_label_en, cfg.stat3_label_hi) },
  ];
  const steps = (lang === "hi" ? cfg.side_steps_hi : cfg.side_steps_en).split("|").map(s => s.trim()).filter(Boolean);

  return (
    <section className="py-10 md:py-16">
      <div className="container mx-auto px-4">
        <div className="relative rounded-3xl overflow-hidden bg-[linear-gradient(135deg,var(--primary)_0%,var(--primary)_55%,color-mix(in_oklab,var(--primary)_85%,transparent)_100%)] shadow-2xl">
          {/* Decorative blobs */}
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-cta/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-cta/15 blur-3xl pointer-events-none" />
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }} />

          <div className="relative flex flex-col md:flex-row gap-8 p-6 md:p-12">
            <div className="flex-1">
              <span className="inline-flex items-center gap-2 bg-cta/15 text-cta border border-cta/30 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider mb-4">
                <Stethoscope className="h-3.5 w-3.5" /> {t(cfg.eyebrow_en, cfg.eyebrow_hi)}
              </span>
              <h2 className="text-2xl md:text-4xl font-bold text-primary-foreground leading-tight mb-3">
                {t(cfg.title_en, cfg.title_hi)}
              </h2>
              <p className="text-primary-foreground/80 mb-6 text-sm md:text-base max-w-xl">
                {t(cfg.description_en, cfg.description_hi)}
              </p>

              <div className="flex items-center gap-4 mb-6 text-[11px] text-primary-foreground/80">
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-cta" /> {t("100% Confidential", "100% गोपनीय")}</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-cta" /> {t("Avg reply < 5 min", "औसत उत्तर < 5 मिनट")}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 md:gap-4 mb-7 max-w-md">
                {stats.map((s) => (
                  <div key={s.label} className="bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10 rounded-xl p-3 text-center">
                    <p className="text-xl md:text-2xl font-extrabold text-cta">{s.val}</p>
                    <p className="text-[10px] md:text-[11px] text-primary-foreground/70 leading-tight mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/consultation" className="group bg-cta text-cta-foreground px-6 py-3 rounded-full text-sm font-bold hover:opacity-90 transition text-center flex items-center justify-center gap-2 shadow-lg shadow-cta/30">
                  <Sparkles className="h-4 w-4" /> {t(cfg.cta_en, cfg.cta_hi)} <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition" />
                </Link>
                <a href={`tel:${cfg['phone']}`} className="border border-primary-foreground/30 text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold hover:bg-primary-foreground/10 transition flex items-center justify-center gap-2">
                  <Phone className="h-4 w-4" /> {t("Call Us", "कॉल करें")}
                </a>
              </div>
            </div>

            <div className="hidden md:flex items-center">
              <Link to="/consultation" className="bg-primary-foreground/10 backdrop-blur-md border border-primary-foreground/15 rounded-2xl p-6 min-w-[300px] hover:bg-primary-foreground/15 transition group cursor-pointer block shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-cta/20 p-3 rounded-full ring-2 ring-cta/30">
                    <Stethoscope className="h-6 w-6 text-cta" />
                  </div>
                  <h3 className="text-primary-foreground font-bold text-lg">{t(cfg.side_title_en, cfg.side_title_hi)}</h3>
                </div>
                <ul className="space-y-2.5 mb-5">
                  {steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-primary-foreground/85 text-sm">
                      <span className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-cta text-cta-foreground text-[10px] font-bold shrink-0">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
                <div className="bg-cta text-cta-foreground py-3 rounded-xl font-bold text-sm text-center group-hover:opacity-90 transition flex items-center justify-center gap-2">
                  {t(cfg.cta_en, cfg.cta_hi)} <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ConsultationBanner;
