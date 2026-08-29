import { Facebook, Instagram, Youtube, Twitter, MessageCircle, AtSign, Home, ShoppingBag, BookOpen, Mail as MailIcon, Stethoscope, User, LogOut, X, HeartPulse, Dumbbell, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchCategories, navbarTree, categoryName, type Category } from "@/hooks/use-categories";

import logo from "@/assets/logo.png";


const SOCIAL_KEYS = [
  { key: "facebook_url", Icon: Facebook, label: "Facebook", color: "text-blue-600" },
  { key: "instagram_url", Icon: Instagram, label: "Instagram", color: "text-pink-600" },
  { key: "youtube_url", Icon: Youtube, label: "YouTube", color: "text-red-600" },
  { key: "twitter_url", Icon: Twitter, label: "X", color: "text-foreground" },
  { key: "whatsapp_url", Icon: MessageCircle, label: "WhatsApp", color: "text-green-600" },
  { key: "threads_url", Icon: AtSign, label: "Threads", color: "text-foreground" },
];

// Categories come from the centralized admin-controlled system — never hardcoded.



const MobileMenu = ({ onClose }: { onClose: () => void }) => {
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [session, setSession] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const { t, lang } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase
      .from("site_settings")
      .select("key, value")
      .in("key", SOCIAL_KEYS.map(s => s.key))
      .then(({ data }) => {
        const m: Record<string, string> = {};
        (data || []).forEach((d: any) => { if (d.value) m[d.key] = d.value; });
        setSocials(m);
      });
    fetchCategories(true).then(setCategories);
    return () => subscription.unsubscribe();
  }, []);

  const getName = (c: Category) => categoryName(c, lang);
  const menuTree = navbarTree(categories);



  const handleLogout = async () => {
    await supabase.auth.signOut();
    onClose();
    navigate({ to: "/" });
  };

  const tiles: { to?: string; onClick?: () => void; label: string; Icon: any }[] = [
    { to: "/", label: t("Home", "होम"), Icon: Home },
    { to: "/products", label: t("Shop", "शॉप"), Icon: ShoppingBag },
    { to: "/blog", label: t("Blog", "ब्लॉग"), Icon: BookOpen },
    { to: "/contact", label: t("Contact Us", "संपर्क करें"), Icon: MailIcon },
    { to: "/consultation", label: t("Doctor Consultation", "डॉक्टर परामर्श"), Icon: Stethoscope },
    { to: session ? "/my-profile" : "/auth", label: session ? t("My Account", "मेरा अकाउंट") : t("Login / Sign Up", "लॉगिन"), Icon: User },
  ];

  // Dropdown menus = top-level categories flagged "Show in Navbar" by the admin.



  const activeSocials = SOCIAL_KEYS.filter(s => socials[s.key]);

  return createPortal(
    <>
      <div className="lg:hidden fixed inset-0 z-[200] bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="lg:hidden fixed inset-y-0 left-0 w-[88%] max-w-[400px] z-[210] bg-background overflow-y-auto shadow-2xl animate-fade-in flex flex-col">

        {/* Brand block */}
        <div className="relative m-3 p-4 rounded-2xl bg-primary/5 border border-primary/10">
          <button onClick={onClose} aria-label="Close menu" className="absolute top-3 right-3 h-9 w-9 rounded-full bg-card hover:bg-muted text-foreground flex items-center justify-center transition shadow-sm">
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <div className="flex items-center gap-3 pr-12">
            <img loading="lazy" decoding="async" src={logo} alt="VedicUpchar" className="w-14 h-14 rounded-xl object-contain bg-card p-1.5 shadow-sm" />
            <div>
              <div className="text-2xl font-extrabold text-primary leading-none">VedicUpchar</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-primary/70 font-semibold mt-1">{t("Ayurvedic Healthcare", "आयुर्वेदिक स्वास्थ्य")}</div>
            </div>
          </div>
          <div className="text-[15px] font-bold text-foreground leading-snug mt-3">
            {t("INDIA's Most Trusted Ayurvedic Brand", "भारत का सबसे भरोसेमंद आयुर्वेदिक ब्रांड")}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {t("100% Ayurvedic & Herbal Products", "100% आयुर्वेदिक एवं हर्बल उत्पाद")}
          </div>
        </div>

        {/* Health dropdown menus — fully admin controlled */}
        <div className="px-3 space-y-2.5 mb-2.5">
          {menuTree.filter(g => g.children.length > 0).map(({ parent, children }) => {
            const open = openKey === parent.id;
            return (
              <div key={parent.id} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <button
                  onClick={() => setOpenKey(open ? null : parent.id)}
                  aria-expanded={open}
                  className="w-full flex items-center gap-2.5 px-3 py-3.5 text-left"
                >
                  <HeartPulse className="h-5 w-5 text-foreground shrink-0" strokeWidth={1.7} />
                  <span className="text-[15px] font-semibold text-foreground flex-1">{getName(parent)}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="border-t border-border px-3 py-2 max-h-[45vh] overflow-y-auto">
                    <Link to="/products" search={{ category: parent.slug }} onClick={onClose} className="block py-2 text-sm text-primary font-medium">
                      {t("View all", "सभी देखें")} — {getName(parent)}
                    </Link>
                    {children.map(({ child, grandChildren }) => (
                      <div key={child.id} className="py-2">
                        <Link
                          to="/products" search={{ category: child.slug }}
                          onClick={onClose}
                          className="block text-[11px] font-bold uppercase tracking-wider text-primary mb-1.5"
                        >
                          {getName(child)}
                        </Link>
                        {grandChildren.length > 0 && (
                          <ul className="space-y-1.5 pl-1">
                            {grandChildren.map(g => (
                              <li key={g.id}>
                                <Link
                                  to="/products" search={{ category: g.slug }}
                                  onClick={onClose}
                                  className="block text-sm text-muted-foreground hover:text-primary transition"
                                >
                                  {getName(g)}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );

          })}
        </div>

        {/* Tile grid */}

        <div className="grid grid-cols-2 gap-2.5 px-3">
          {tiles.map((tile, i) => {
            const Icon = tile.Icon;
            const content = (
              <div className="h-[68px] rounded-xl border border-border bg-card hover:bg-secondary hover:border-primary/40 transition flex items-center gap-2.5 px-3 shadow-sm">
                <Icon className="h-5 w-5 text-foreground shrink-0" strokeWidth={1.7} />
                <span className="text-[15px] font-semibold text-foreground leading-tight">{tile.label}</span>
              </div>
            );
            return tile.to ? (
              <Link key={i} to={tile.to} onClick={onClose}>{content}</Link>
            ) : (
              <button key={i} onClick={tile.onClick}>{content}</button>
            );
          })}
        </div>

        {/* Logout */}
        {session && (
          <div className="px-3 mt-3">
            <button onClick={handleLogout} className="w-full py-3 rounded-xl bg-muted hover:bg-destructive/10 text-destructive font-bold text-[15px] flex items-center justify-center gap-2 border border-border transition">
              <LogOut className="h-4 w-4" /> {t("Logout", "लॉगआउट")}
            </button>
          </div>
        )}

        {activeSocials.length > 0 && (
          <div className="px-4 py-5 mt-auto border-t border-border bg-muted/30">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {t("Follow Us", "हमें फॉलो करें")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {activeSocials.map(s => (
                <a key={s.key} href={socials[s.key]} target="_blank" rel="noopener noreferrer"
                  aria-label={s.label}
                  className={`w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition shadow-sm ${s.color}`}>
                  <s.Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
};

export default MobileMenu;
