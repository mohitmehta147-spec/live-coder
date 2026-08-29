import { useEffect, useState } from "react";
import { Mail, Phone, MapPin, Facebook, Instagram, Youtube, Twitter, MessageCircle, AtSign } from "lucide-react";
import { supabase } from "@/lib/supabase";
import NewsletterForm from "@/components/NewsletterForm";

type CustomLink = { label: string; url: string; icon?: string };

const SiteFooter = () => {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<CustomLink[]>([]);
  const [contact, setContact] = useState({ phone: "+91 98765 43210", phone2: "+91 92 66 300 600", email: "support@vedicupchar.com", address: "123 Ayurveda Lane, New Delhi" });

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("site_settings").select("key, value").in("key", [
        "facebook_url", "instagram_url", "youtube_url", "twitter_url", "whatsapp_url", "threads_url",
        "custom_social_links", "store_phone", "store_phone_2", "store_email", "store_address",
      ]);
      const map: Record<string, string> = {};
      let cust: CustomLink[] = [];
      (data || []).forEach(d => {
        if (d.key === "custom_social_links") {
          try { cust = JSON.parse(d.value || "[]"); } catch { cust = []; }
        } else {
          map[d.key] = d.value || "";
        }
      });
      setLinks(map);
      setCustom(Array.isArray(cust) ? cust : []);
      setContact(c => ({
        phone: map['store_phone'] || c['phone'],
        phone2: map['store_phone_2'] || c.phone2,
        email: map['store_email'] || c.email,
        address: map['store_address'] || c.address,
      }));
    };
    fetch();
  }, []);

  const fixedSocials = [
    { key: "facebook_url", Icon: Facebook, label: "Facebook" },
    { key: "instagram_url", Icon: Instagram, label: "Instagram" },
    { key: "youtube_url", Icon: Youtube, label: "YouTube" },
    { key: "twitter_url", Icon: Twitter, label: "X" },
    { key: "whatsapp_url", Icon: MessageCircle, label: "WhatsApp" },
    { key: "threads_url", Icon: AtSign, label: "Threads" },
  ].filter(s => links[s.key]);

  return (
    <footer className="bg-footer text-footer-foreground">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          <div>
            <h3 className="text-lg font-bold text-footer-heading mb-3">VedicUpchar</h3>
            <p className="text-sm text-footer-foreground/70 mb-4">
              Your trusted source for authentic Ayurvedic and herbal healthcare products.
            </p>
            <div className="flex flex-wrap gap-3">
              {fixedSocials.map(s => (
                <a key={s.key} href={links[s.key]} target="_blank" rel="noopener noreferrer"
                  title={s.label}
                  className="w-8 h-8 rounded-full bg-footer-foreground/10 flex items-center justify-center hover:bg-primary transition">
                  <s.Icon className="w-4 h-4" />
                </a>
              ))}
              {custom.filter(c => c.url).map((c, i) => (
                <a key={i} href={c.url} target="_blank" rel="noopener noreferrer"
                  title={c.label}
                  className="w-8 h-8 rounded-full bg-footer-foreground/10 flex items-center justify-center hover:bg-primary transition text-sm">
                  <span>{c.icon || "🔗"}</span>
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-footer-heading mb-3 text-sm">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { label: "About Us", href: "#" },
                { label: "Shop All", href: "/products" },
                { label: "Contact Us", href: "/contact" },
                { label: "Doctor Consultation", href: "/consultation" },
                { label: "Track Order", href: "/track-order" },
                { label: "My Orders", href: "/my-orders" },
                { label: "Blog", href: "/blog" },
                { label: "Privacy Policy", href: "/privacy-policy" },
                { label: "Terms & Conditions", href: "/terms" },
              ].map((l) => (
                <li key={l.label}><a href={l.href} className="text-sm text-footer-foreground/70 hover:text-primary transition">{l.label}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-footer-heading mb-3 text-sm">Health Concerns</h4>
            <ul className="space-y-2">
              {["Diabetes Care", "Heart Care", "Immunity", "Digestive Health", "Pain Management", "Women's Health"].map((l) => (
                <li key={l}><a href="#" className="text-sm text-footer-foreground/70 hover:text-primary transition">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-footer-heading mb-3 text-sm">Contact</h4>
            <ul className="space-y-3 text-sm text-footer-foreground/70">
              <li>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-2 hover:text-primary transition">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0" />{contact.address}
                </a>
              </li>
              <li>
                <a href={`tel:${contact['phone'].replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-primary transition">
                  <Phone className="h-4 w-4 shrink-0" />{contact['phone']}
                </a>
              </li>
              {contact.phone2 && (
                <li>
                  <a href={`tel:${contact.phone2.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-primary transition">
                    <Phone className="h-4 w-4 shrink-0" />{contact.phone2}
                  </a>
                </li>
              )}
              <li className="min-w-0">
                <a href={`mailto:${contact.email}`} className="flex items-start gap-2 hover:text-primary transition min-w-0">
                  <Mail className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="break-all">{contact.email}</span>
                </a>
              </li>
            </ul>
            <NewsletterForm />
          </div>
        </div>
        <div className="border-t border-footer-foreground/10 mt-8 pt-4 text-center text-xs text-footer-foreground/50 space-y-1">
          <p className="font-semibold text-footer-foreground/70">VEDIC UPCHAR PRIVATE LIMITED</p>
          <p>© 2026 VedicUpchar. All rights reserved.</p>
          <p>
            Developed by{" "}
            <a href="https://digitaltank.in" target="_blank" rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline">
              Digitaltank
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
