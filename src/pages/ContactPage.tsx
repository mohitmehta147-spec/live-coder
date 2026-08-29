import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Mail, Phone, MapPin, Send, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { notifyAdmin } from "@/lib/notify-admin";

const ContactPage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  usePageMeta("Contact Us - VedicUpchar", "Get in touch with VedicUpchar for queries, support, or feedback.");

  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [contact, setContact] = useState({ phone: "+91 98765 43210", email: "support@vedicupchar.com", address: "123 Ayurveda Lane, New Delhi", mapUrl: "", title: "", subtitle: "", heroImage: "" });
  const [branches, setBranches] = useState<Array<{ name: string; phone: string; email: string; address: string; map_url: string }>>([]);

  // Normalize map input: accept iframe HTML, embed URL, or plain google maps share URL
  const normalizeMapUrl = (raw: string): string => {
    if (!raw) return "";
    const trimmed = raw.trim();
    const srcMatch = trimmed.match(/src\s*=\s*["']([^"']+)["']/i);
    if (srcMatch) return srcMatch[1];
    if (/google\.[^/]+\/maps\/embed/i.test(trimmed)) return trimmed;
    if (/google\.[^/]+\/maps/i.test(trimmed) || /maps\.app\.goo\.gl/i.test(trimmed) || /goo\.gl\/maps/i.test(trimmed)) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&output=embed`;
    }
    // Fallback: treat as place name / address
    return `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&output=embed`;
  };

  useEffect(() => {
    supabase.from("site_settings").select("key, value").in("key", ["store_phone", "store_email", "store_address", "store_map_url", "contact_hero_title", "contact_hero_subtitle", "contact_hero_image", "contact_branches"]).then(({ data }) => {
      const map: Record<string, string> = {};
      (data || []).forEach(d => { map[d.key] = d.value || ""; });
      setContact(c => ({
        phone: map['store_phone'] || c['phone'],
        email: map['store_email'] || c.email,
        address: map['store_address'] || c.address,
        mapUrl: map['store_map_url'] ? normalizeMapUrl(map['store_map_url']) : "",
        title: map['contact_hero_title'] || "",
        subtitle: map['contact_hero_subtitle'] || "",
        heroImage: map['contact_hero_image'] || "",
      }));
      try {
        const parsed = map['contact_branches'] ? JSON.parse(map['contact_branches']) : [];
        if (Array.isArray(parsed)) setBranches(parsed);
      } catch { /* ignore */ }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = form['phone'].replace(/\D/g, "").slice(-10);
    if (!form.name.trim() || !form.message.trim() || cleanPhone.length !== 10) {
      toast({ title: t("Please fill name, valid 10-digit mobile and message", "नाम, 10 अंकों का मोबाइल और संदेश ज़रूरी है"), variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("contact_inquiries").insert({
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form['phone'].trim() || null,
      subject: form.subject.trim() || null,
      message: form.message.trim(),
    });
    setLoading(false);
    if (error) {
      toast({ title: t("Failed to send message", "संदेश भेजने में विफल"), variant: "destructive" });
    } else {
      notifyAdmin({
        formType: "Contact Us Inquiry",
        fields: { name: form.name, email: form.email, phone: form['phone'], subject: form.subject, message: form.message },
      });
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <SiteHeader />
        <div className="container mx-auto px-4 py-16 max-w-lg text-center">
          <div className="bg-card rounded-2xl border border-border p-8">
            <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">{t("Message Sent!", "संदेश भेज दिया!")}</h2>
            <p className="text-muted-foreground mb-6">{t("We'll get back to you within 24 hours.", "हम 24 घंटे के भीतर आपसे संपर्क करेंगे।")}</p>
            <button onClick={() => { setSubmitted(false); setForm({ name: "", email: "", phone: "", subject: "", message: "" }); }}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition">
              {t("Send Another Message", "एक और संदेश भेजें")}
            </button>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <SiteHeader />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {contact.heroImage && (
          <div className="mb-6 rounded-2xl overflow-hidden border border-border">
            <img loading="lazy" decoding="async" src={contact.heroImage} alt={contact.title || "Contact Us"} className="w-full h-48 md:h-64 object-cover"
              onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
          </div>
        )}
        <h1 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-2">{contact.title || t("Contact Us", "हमसे संपर्क करें")}</h1>
        <p className="text-center text-muted-foreground mb-8">{contact.subtitle || t("We'd love to hear from you! Reach out to us anytime.", "हमें आपसे सुनना अच्छा लगेगा!")}</p>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { icon: Phone, title: t("Call Us", "कॉल करें"), detail: contact['phone'], href: `tel:${contact['phone'].replace(/\s/g, "")}`, external: false },
            { icon: Mail, title: t("Email Us", "ईमेल करें"), detail: contact.email, href: `mailto:${contact.email}`, external: false },
            { icon: MapPin, title: t("Visit Us", "मिलने आएं"), detail: contact.address, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`, external: true },
          ].map((item, i) => (
            <a key={i} href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined}
              className="bg-card rounded-xl border border-border p-5 text-center hover:shadow-md transition group">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
              <p className="text-muted-foreground text-xs mt-1">{item.detail}</p>
            </a>
          ))}
        </div>

        {contact.mapUrl && (
          <div className="mb-8 rounded-2xl overflow-hidden border border-border aspect-video">
            <iframe src={contact.mapUrl} title="Main location map" className="w-full h-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
          </div>
        )}

        {branches.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4 text-center">{t("Our Branches", "हमारी शाखाएँ")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {branches.map((b, i) => {
                const mUrl = normalizeMapUrl(b.map_url);
                return (
                  <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col">
                    {mUrl && (
                      <div className="aspect-video">
                        <iframe src={mUrl} title={`${b.name || 'Branch'} map`} className="w-full h-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
                      </div>
                    )}
                    <div className="p-5 space-y-2">
                      <h3 className="font-bold text-foreground text-base">{b.name || `Branch ${i + 1}`}</h3>
                      {b.address && <p className="text-sm text-muted-foreground flex items-start gap-2"><MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {b.address}</p>}
                      {b['phone'] && <a href={`tel:${b['phone'].replace(/\s/g, '')}`} className="text-sm text-foreground hover:text-primary flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> {b['phone']}</a>}
                      {b.email && <a href={`mailto:${b.email}`} className="text-sm text-foreground hover:text-primary flex items-center gap-2 break-all"><Mail className="h-4 w-4 text-primary" /> {b.email}</a>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-bold text-foreground">{t("Send us a message", "हमें संदेश भेजें")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder={`${t("Your Name", "आपका नाम")} *`} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
              className="px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
            <input placeholder={t("Email", "ईमेल")} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
            <input placeholder={`${t("Phone", "फ़ोन")} *`} type="tel" required inputMode="numeric" maxLength={10} value={form['phone']}
              onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
              className="px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />

            <input placeholder={t("Subject", "विषय")} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
              className="px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
          </div>
          <textarea placeholder={`${t("Your Message", "आपका संदेश")} *`} rows={5} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required
            className="w-full px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none resize-none" />
          <button type="submit" disabled={loading}
            className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
            <Send className="h-4 w-4" />
            {loading ? t("Sending...", "भेज रहे हैं...") : t("Send Message", "संदेश भेजें")}
          </button>
        </form>
      </div>
      <SiteFooter />
    </div>
  );
};

export default ContactPage;
