import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { X, Sparkles, HeartPulse, ShieldCheck } from "lucide-react";
import { notifyAdmin } from "@/lib/notify-admin";

const DEFAULT_DISEASES = [
  { en: "General Wellness", hi: "सामान्य स्वास्थ्य" },
  { en: "Diabetes", hi: "मधुमेह" },
  { en: "Joint & Pain", hi: "जोड़ और दर्द" },
  { en: "Hair & Skin", hi: "बाल और त्वचा" },
  { en: "Women's Health", hi: "महिला स्वास्थ्य" },
  { en: "Digestion / Acidity", hi: "पाचन / अम्लता" },
  { en: "Weight Management", hi: "वजन प्रबंधन" },
  { en: "Sexual Wellness", hi: "यौन स्वास्थ्य" },
  { en: "Heart Care", hi: "हृदय देखभाल" },
  { en: "Other", hi: "अन्य" },
];

const ConsultationPopup = () => {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [diseases, setDiseases] = useState(DEFAULT_DISEASES);
  const [form, setForm] = useState({
    patient_name: "",
    mobile: "",
    gender: "",
    age: "",
    disease: "",
  });

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "consultation_diseases").maybeSingle().then(({ data }) => {
      if (data?.value) {
        try {
          const v = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
          if (Array.isArray(v) && v.length) setDiseases(v);
        } catch {}
      }
    });
    if (sessionStorage.getItem("consult_popup_seen")) return;
    const timer = setTimeout(() => setOpen(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  const close = () => {
    setOpen(false);
    sessionStorage.setItem("consult_popup_seen", "1");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient_name.trim() || !form['mobile'].trim() || !form.gender || !form.age || !form.disease) {
      toast({ title: t("Please fill all fields", "कृपया सभी फ़ील्ड भरें"), variant: "destructive" });
      return;
    }
    const cleanMobile = form['mobile'].replace(/\D/g, "").slice(-10);
    if (cleanMobile.length !== 10) {
      toast({ title: t("Enter valid 10-digit mobile", "10 अंकों का वैध मोबाइल"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("consultations").insert([{
      patient_name: form.patient_name.trim(),
      mobile: cleanMobile,
      gender: form.gender,
      age: form.age,
      disease: form.disease,
      consultation_type: "Quick Inquiry (Homepage Popup)",
      user_id: session?.user?.id ?? null,
    }]);
    setSubmitting(false);
    if (error) {
      toast({ title: t("Submission failed", "सबमिट विफल"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("✅ Thank you! Our doctor will call you soon.", "✅ धन्यवाद! हमारे डॉक्टर जल्द कॉल करेंगे।") });
    notifyAdmin({
      formType: "Home Popup Consultation",
      fields: { patient_name: form.patient_name, mobile: cleanMobile, gender: form.gender, age: form.age, disease: form.disease },
    });
    close();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden border-2 border-primary/20 animate-in zoom-in-95 duration-300">
        <button onClick={close} aria-label="Close"
          className="absolute right-3 top-3 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur hover:bg-background flex items-center justify-center transition">
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="relative bg-linear-to-br from-primary via-primary to-primary/80 text-primary-foreground px-5 pt-6 pb-5">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-6 -left-6 w-24 h-24 bg-white rounded-full blur-2xl" />
            <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-cta rounded-full blur-2xl" />
          </div>
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur rounded-full px-2.5 py-1 mb-2">
              <Sparkles className="h-3 w-3 text-cta" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">{t("Free Consultation", "मुफ्त परामर्श")}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold leading-tight">
              {t("Talk to an Ayurvedic Doctor", "आयुर्वेदिक डॉक्टर से बात करें")}
            </h2>
            <p className="text-xs text-primary-foreground/85 mt-1">
              {t("100% Confidential • Expert Vaidyas • Personalized Care", "100% गोपनीय • विशेषज्ञ वैद्य")}
            </p>
            <div className="flex items-center gap-3 mt-3 text-[11px]">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-cta" /> {t("Trusted by 20L+", "20L+ द्वारा भरोसेमंद")}</span>
              <span className="flex items-center gap-1"><HeartPulse className="h-3 w-3 text-cta" /> {t("3500+ Doctors", "3500+ डॉक्टर")}</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <input
            required
            value={form.patient_name}
            onChange={e => setForm({ ...form, patient_name: e.target.value })}
            placeholder={t("Patient Name *", "मरीज का नाम *")}
            className="w-full px-3.5 py-2.5 rounded-lg border-2 border-border bg-background text-sm focus:border-primary focus:outline-none"
          />
          <input
            required
            inputMode="numeric"
            maxLength={10}
            value={form['mobile']}
            onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
            placeholder={t("Mobile Number *", "मोबाइल नंबर *")}
            className="w-full px-3.5 py-2.5 rounded-lg border-2 border-border bg-background text-sm focus:border-primary focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              required
              value={form.gender}
              onChange={e => setForm({ ...form, gender: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border-2 border-border bg-background text-sm focus:border-primary focus:outline-none"
            >
              <option value="">{t("Gender *", "लिंग *")}</option>
              <option value="Male">{t("Male", "पुरुष")}</option>
              <option value="Female">{t("Female", "महिला")}</option>
              <option value="Other">{t("Other", "अन्य")}</option>
            </select>
            <input
              required
              inputMode="numeric"
              maxLength={3}
              value={form.age}
              onChange={e => setForm({ ...form, age: e.target.value.replace(/\D/g, "").slice(0, 3) })}
              placeholder={t("Age *", "उम्र *")}
              className="w-full px-3.5 py-2.5 rounded-lg border-2 border-border bg-background text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <select
            required
            value={form.disease}
            onChange={e => setForm({ ...form, disease: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border-2 border-border bg-background text-sm focus:border-primary focus:outline-none"
          >
            <option value="">{t("Select Disease / Concern *", "बीमारी चुनें *")}</option>
            {diseases.map(d => (
              <option key={d.en} value={d.en}>{lang === "hi" ? d.hi : d.en}</option>
            ))}
          </select>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 mt-2 bg-linear-to-r from-primary to-primary/85 hover:opacity-95 text-primary-foreground rounded-lg font-bold text-sm shadow-lg shadow-primary/30 transition disabled:opacity-60"
          >
            {submitting ? t("Submitting...", "भेजा जा रहा है...") : t("📞 Get Free Call Back", "📞 मुफ्त कॉल बैक")}
          </button>
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            {t("By submitting, you agree to be contacted by our doctors.", "जमा करके, आप हमारे डॉक्टरों द्वारा संपर्क के लिए सहमत हैं।")}
          </p>
        </form>
      </div>
    </div>
  );
};

export default ConsultationPopup;
