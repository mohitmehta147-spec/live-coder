import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Link, useNavigate } from "@tanstack/react-router";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { User, ChevronRight, Save, LogOut, Phone, Mail, Calendar, MapPin, Package, RotateCcw, Stethoscope, Heart } from "lucide-react";

const MyProfilePage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "", phone: "", email: "", dob: "", address: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate({ to: "/auth" }); return; }
      setSession(session);
      const rawEmail = session.user.email || "";
      const displayEmail = rawEmail.endsWith("@phone.local") ? "" : rawEmail;
      const rawPhone = session.user['phone'] || session.user.user_metadata?.['phone'] || (rawEmail.endsWith("@phone.local") ? rawEmail.split("@")[0] : "") || "";
      const phoneDigits = String(rawPhone).replace(/\D/g, "").slice(-10);

      const { data } = await (supabase as any).from("profiles").select("*").eq("user_id", session.user.id).maybeSingle();
      setProfile({
        full_name: data?.['full_name'] || session.user.user_metadata?.['full_name'] || "",
        phone: data?.['phone'] || phoneDigits,
        email: data?.email || displayEmail,
        dob: data?.dob || "",
        address: data?.address || "",
      });
      setLoading(false);
    });
  }, []);

  const save = async () => {
    if (!session) return;
    if (!profile['full_name'].trim()) { toast({ title: t("Name is required", "नाम आवश्यक है"), variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      user_id: session.user.id,
      full_name: profile['full_name'].trim(),
      phone: profile['phone'].trim() || null,
      email: profile.email.trim() || null,
      dob: profile.dob || null,
      address: profile.address.trim() || null,
    };
    const { error } = await (supabase as any).from("profiles").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) { toast({ title: t("Save failed", "सेव विफल"), description: error.message, variant: "destructive" }); return; }
    toast({ title: t("✅ Profile saved", "✅ प्रोफ़ाइल सेव हो गई") });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar /><SiteHeader />
      <div className="bg-muted/50 border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">{t("Home", "होम")}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{t("My Profile", "मेरी प्रोफ़ाइल")}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-10 max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold flex items-center gap-2"><User className="h-5 w-5 text-primary" />{t("My Profile", "मेरी प्रोफ़ाइल")}</h1>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { to: "/my-orders", icon: Package, label: t("My Orders", "मेरे ऑर्डर") },
            { to: "/my-addresses", icon: MapPin, label: t("My Addresses", "मेरे पते") },
            { to: "/return-request", icon: RotateCcw, label: t("Returns", "वापसी") },
            { to: "/consultation", icon: Stethoscope, label: t("Consultations", "परामर्श") },
          ].map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="bg-card border border-border rounded-xl p-3 flex flex-col items-center gap-2 text-center hover:border-primary hover:shadow-sm transition">
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold text-foreground">{label}</span>
            </Link>
          ))}
        </div>

        {loading ? <p className="text-center text-muted-foreground py-10">{t("Loading...", "लोड हो रहा...")}</p> : (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{t("Customer Name *", "ग्राहक का नाम *")}</label>
              <input value={profile['full_name']} onChange={e => setProfile({...profile, full_name: e.target.value})}
                className="w-full px-3 py-2.5 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{t("Contact Number", "संपर्क नंबर")}</label>
              <input value={profile['phone']} onChange={e => setProfile({...profile, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} inputMode="numeric" maxLength={10}
                className="w-full px-3 py-2.5 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{t("Email", "ईमेल")}</label>
              <input type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})}
                className="w-full px-3 py-2.5 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{t("Date of Birth", "जन्म तिथि")}</label>
              <input type="date" value={profile.dob} onChange={e => setProfile({...profile, dob: e.target.value})}
                className="w-full px-3 py-2.5 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{t("Address", "पता")}</label>
              <textarea value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})} rows={3}
                className="w-full px-3 py-2.5 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {t("Manage multiple delivery addresses in", "एक से अधिक डिलीवरी पते यहाँ प्रबंधित करें")} <Link to="/my-addresses" className="text-primary font-semibold hover:underline">{t("My Addresses", "मेरे पते")}</Link>
              </p>
            </div>
            <button onClick={save} disabled={saving}
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
              <Save className="h-4 w-4" />
              {saving ? t("Saving...", "सेव हो रहा है...") : t("Save Profile", "प्रोफ़ाइल सेव करें")}
            </button>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
};

export default MyProfilePage;
