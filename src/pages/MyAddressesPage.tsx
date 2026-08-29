import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "@tanstack/react-router";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { MapPin, Plus, Pencil, Trash2, Star, X, ChevronRight } from "lucide-react";

type Address = {
  id?: string;
  label?: string | null;
  full_name: string;
  phone: string;
  address: string;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  is_default?: boolean | null;
};

const empty: Address = { full_name: "", phone: "", address: "", city: "", state: "", pincode: "", label: "Home", is_default: false };

const MyAddressesPage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [list, setList] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Address | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) { navigate({ to: "/auth" }); return; }
      load(session.user.id);
    });
  }, []);

  const load = async (uid: string) => {
    setLoading(true);
    const { data } = await (supabase as any).from("user_addresses").select("*").eq("user_id", uid).order("is_default", { ascending: false }).order("created_at", { ascending: false });
    setList((data as any) || []);
    setLoading(false);
  };

  const save = async () => {
    if (!editing || !session) return;
    if (!editing['full_name'].trim() || !editing['phone'].trim() || !editing.address.trim()) {
      toast({ title: t("Name, phone & address required", "नाम, फोन और पता आवश्यक"), variant: "destructive" }); return;
    }
    const payload = { ...editing, user_id: session.user.id };
    delete (payload as any).id;
    if (editing.id) {
      await (supabase as any).from("user_addresses").update(payload).eq("id", editing.id);
    } else {
      await (supabase as any).from("user_addresses").insert([payload]);
    }
    if (editing.is_default && session) {
      await (supabase as any).from("user_addresses").update({ is_default: false }).eq("user_id", session.user.id).neq("id", editing.id || "00000000-0000-0000-0000-000000000000");
    }
    setEditing(null);
    toast({ title: t("Saved", "सेव हो गया") });
    load(session.user.id);
  };

  const del = async (id: string) => {
    if (!confirm(t("Delete this address?", "इस पते को हटाएं?"))) return;
    await (supabase as any).from("user_addresses").delete().eq("id", id);
    if (session) load(session.user.id);
  };

  const setDefault = async (a: Address) => {
    if (!session) return;
    await (supabase as any).from("user_addresses").update({ is_default: false }).eq("user_id", session.user.id);
    await (supabase as any).from("user_addresses").update({ is_default: true }).eq("id", a.id!);
    load(session.user.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar /><SiteHeader />
      <div className="bg-muted/50 border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">{t("Home", "होम")}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{t("My Addresses", "मेरे पते")}</span>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-6 md:py-10 max-w-3xl">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />{t("Saved Addresses", "सहेजे गए पते")}</h1>
          <button onClick={() => setEditing({ ...empty })} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90">
            <Plus className="h-4 w-4" /> {t("Add New", "नया जोड़ें")}
          </button>
        </div>

        {loading ? <p className="text-center text-muted-foreground py-10">{t("Loading...", "लोड हो रहा...")}</p> :
        list.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">{t("No saved addresses yet", "अभी तक कोई पता सहेजा नहीं गया")}</p>
            <button onClick={() => setEditing({ ...empty })} className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold">
              {t("Add Your First Address", "अपना पहला पता जोड़ें")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {list.map(a => (
              <div key={a.id} className="bg-card border border-border rounded-2xl p-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded">{a.label || "Address"}</span>
                    {a.is_default && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold">{t("DEFAULT", "डिफ़ॉल्ट")}</span>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(a)} className="p-1.5 hover:bg-muted rounded"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => del(a.id!)} className="p-1.5 hover:bg-destructive/10 rounded"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                  </div>
                </div>
                <p className="font-semibold text-sm">{a['full_name']}</p>
                <p className="text-xs text-muted-foreground">{a['phone']}</p>
                <p className="text-sm mt-1.5">{a.address}</p>
                <p className="text-xs text-muted-foreground">{[a.city, a.state, a.pincode].filter(Boolean).join(", ")}</p>
                {!a.is_default && (
                  <button onClick={() => setDefault(a)} className="mt-3 text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1">
                    <Star className="h-3 w-3" /> {t("Set as default", "डिफ़ॉल्ट बनाएं")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editing.id ? t("Edit Address", "पता संपादित करें") : t("Add Address", "पता जोड़ें")}</h3>
              <button onClick={() => setEditing(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <select value={editing.label || "Home"} onChange={e => setEditing({ ...editing, label: e.target.value })}
                className="w-full px-3 py-2.5 border-2 border-border rounded-xl text-sm bg-background">
                <option value="Home">{t("Home", "घर")}</option>
                <option value="Work">{t("Work", "कार्यालय")}</option>
                <option value="Other">{t("Other", "अन्य")}</option>
              </select>
              <input placeholder={t("Full Name *", "पूरा नाम *")} value={editing['full_name']} onChange={e => setEditing({ ...editing, full_name: e.target.value })}
                className="w-full px-3 py-2.5 border-2 border-border rounded-xl text-sm bg-background" />
              <input placeholder={t("Phone *", "फोन *")} value={editing['phone']} onChange={e => setEditing({ ...editing, phone: e.target.value })}
                className="w-full px-3 py-2.5 border-2 border-border rounded-xl text-sm bg-background" />
              <textarea placeholder={t("Address *", "पता *")} value={editing.address} onChange={e => setEditing({ ...editing, address: e.target.value })}
                rows={2} className="w-full px-3 py-2.5 border-2 border-border rounded-xl text-sm bg-background" />
              <input placeholder={t("Pincode", "पिनकोड")} value={editing.pincode || ""} onChange={async e => {
                const pin = e.target.value;
                setEditing({ ...editing, pincode: pin });
                if (pin.length === 6) {
                  try {
                    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
                    const data = await res.json();
                    if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
                      const po = data[0].PostOffice[0];
                      setEditing(prev => prev ? { ...prev, pincode: pin, city: po.District, state: po.State } : prev);
                    }
                  } catch {}
                }
              }} className="w-full px-3 py-2.5 border-2 border-border rounded-xl text-sm bg-background" />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder={t("City", "शहर")} value={editing.city || ""} onChange={e => setEditing({ ...editing, city: e.target.value })}
                  className="px-3 py-2.5 border-2 border-border rounded-xl text-sm bg-background" />
                <input placeholder={t("State", "राज्य")} value={editing.state || ""} onChange={e => setEditing({ ...editing, state: e.target.value })}
                  className="px-3 py-2.5 border-2 border-border rounded-xl text-sm bg-background" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!editing.is_default} onChange={e => setEditing({ ...editing, is_default: e.target.checked })} />
                {t("Set as default address", "डिफ़ॉल्ट पता बनाएं")}
              </label>
              <button onClick={save} className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90">
                {t("Save Address", "पता सेव करें")}
              </button>
            </div>
          </div>
        </div>
      )}
      <SiteFooter />
    </div>
  );
};

export default MyAddressesPage;
