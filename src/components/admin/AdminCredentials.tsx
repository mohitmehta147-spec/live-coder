import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type CredentialCard = { title: string; icon?: string; fields: { key: string; label: string; placeholder: string; type?: string }[]; toggleKey?: string; toggleLabel?: string; };

const CREDENTIAL_CARDS: CredentialCard[] = [
  { title: "Razorpay", icon: "💳", toggleKey: "razorpay_enabled", toggleLabel: "Enable Razorpay Payments", fields: [{ key: "razorpay_key_id", label: "RAZOR KEY", placeholder: "rzp_live_xxxxxxxxxxxx" }, { key: "razorpay_key_secret", label: "RAZOR SECRET", placeholder: "Your Razorpay Secret Key", type: "password" }] },
  { title: "Google Login", icon: "🔵", toggleKey: "google_login_enabled", toggleLabel: "Enable Google Sign-In", fields: [{ key: "google_client_id", label: "Client ID", placeholder: "xxxx.apps.googleusercontent.com" }, { key: "google_client_secret", label: "Client Secret", placeholder: "Google Client Secret", type: "password" }] },
  { title: "Facebook Login", icon: "📘", toggleKey: "facebook_login_enabled", toggleLabel: "Enable Facebook Login", fields: [{ key: "facebook_app_id", label: "App ID", placeholder: "Facebook App ID" }, { key: "facebook_app_secret", label: "App Secret", placeholder: "Facebook App Secret", type: "password" }] },
  { title: "Twitter Login", icon: "🐦", toggleKey: "twitter_login_enabled", toggleLabel: "Enable Twitter Login", fields: [{ key: "twitter_client_id", label: "Client ID", placeholder: "Twitter Client ID" }, { key: "twitter_client_secret", label: "Client Secret", placeholder: "Twitter Client Secret", type: "password" }] },
  { title: "Apple Login", icon: "🍎", toggleKey: "apple_login_enabled", toggleLabel: "Enable Apple Sign-In", fields: [{ key: "apple_callback_url", label: "Callback URL", placeholder: "https://yourdomain.com/callback" }, { key: "apple_client_id", label: "Client ID", placeholder: "Apple Client ID" }, { key: "apple_client_secret", label: "Client Secret", placeholder: "Apple Client Secret", type: "password" }] },
];

const SMS_OTP_FIELDS: CredentialCard = { title: "SMS (CloudB2B Solutions)", icon: "📱", toggleKey: "sms_otp_enabled", toggleLabel: "Enable SMS Notifications", fields: [{ key: "sms_api_url", label: "API URL", placeholder: "http://sms1.cloudb2bsolutions.com/api/SmsApi/Api" }, { key: "sms_username", label: "UserID", placeholder: "vedic" }, { key: "sms_password", label: "Password", placeholder: "SMS Login Password", type: "password" }, { key: "sms_sender_id", label: "Sender ID", placeholder: "VEDICU" }, { key: "sms_entity_id", label: "Entity ID", placeholder: "170xxxxxxxxxxxxxx289" }, { key: "sms_template_id_order", label: "Order Template ID", placeholder: "1707177329603753376" }, { key: "sms_template_id_otp", label: "OTP Template ID", placeholder: "DLT Template ID for OTP" }] };

const SMTP_FIELDS: CredentialCard = { title: "SMTP / Email Settings", icon: "📧", toggleKey: "smtp_enabled", toggleLabel: "Enable Custom SMTP", fields: [{ key: "smtp_host", label: "SMTP Host", placeholder: "smtp.gmail.com" }, { key: "smtp_port", label: "SMTP Port", placeholder: "587" }, { key: "smtp_username", label: "Username / Email", placeholder: "your-email@gmail.com" }, { key: "smtp_password", label: "Password", placeholder: "App Password", type: "password" }, { key: "smtp_from_name", label: "From Name", placeholder: "VedicUpchar" }, { key: "smtp_from_email", label: "From Email", placeholder: "noreply@vedicupchar.com" }, { key: "smtp_encryption", label: "Encryption", placeholder: "TLS / SSL" }] };

const AdminAccountCard = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [newId, setNewId] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const e = data.user?.email || "";
      setEmail(e);
      setNewId(e.endsWith("@phone.local") ? e.replace("@phone.local", "") : e);
    });
  }, []);

  const saveId = async () => {
    const v = newId.trim();
    if (!v) { toast({ title: "Enter a user ID", variant: "destructive" }); return; }
    const nextEmail = /^\d{10}$/.test(v) ? `${v}@phone.local` : v;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: nextEmail });
    setBusy(false);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✅ User ID updated", description: "Use the new ID at next login." });
  };

  const savePw = async () => {
    if (pw1.length < 6) { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    if (pw1 !== pw2) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setBusy(false);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    setPw1(""); setPw2("");
    toast({ title: "✅ Password changed" });
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <span className="text-2xl">🔑</span>
        <div>
          <h3 className="font-semibold text-foreground">Change User ID &amp; Password</h3>
          <p className="text-xs text-muted-foreground">Current login: {email || "—"}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-sm font-medium min-w-[130px]">New User ID</label>
          <input value={newId} onChange={e => setNewId(e.target.value)} placeholder="mobile number or email"
            className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm bg-background" />
        </div>
        <div className="flex justify-end">
          <button onClick={saveId} disabled={busy} className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">Update User ID</button>
        </div>
        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-sm font-medium min-w-[130px]">New Password</label>
            <input type="password" value={pw1} onChange={e => setPw1(e.target.value)} placeholder="••••••"
              className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm bg-background" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-sm font-medium min-w-[130px]">Confirm Password</label>
            <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="••••••"
              className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm bg-background" />
          </div>
          <div className="flex justify-end">
            <button onClick={savePw} disabled={busy} className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">Change Password</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminCredentials = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase.from("site_settings").select("*").then(({ data }) => {
      const vals: Record<string, string> = {};
      const togs: Record<string, boolean> = {};
      (data || []).forEach((s: any) => { vals[s.key] = s.value || ""; if (s.key.endsWith("_enabled")) togs[s.key] = s.value === "true"; });
      setValues(vals); setToggles(togs); setLoading(false);
    });
  }, []);

  const handleChange = (key: string, val: string) => setValues(prev => ({ ...prev, [key]: val }));
  const handleToggle = (key: string) => setToggles(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async (card: CredentialCard) => {
    setSaving(card.title);
    const allKeys = card.fields.map(f => f.key);
    if (card.toggleKey) allKeys.push(card.toggleKey);
    for (const key of allKeys) {
      const val = key === card.toggleKey ? String(toggles[key] ?? false) : (values[key] || "");
      await supabase.from("site_settings").upsert([{ key, value: val }], { onConflict: "key" });
    }
    setSaving(null);
    toast({ title: `✅ ${card.title} settings saved!` });
  };

  const renderCard = (card: CredentialCard) => (
    <div key={card.title} className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{card.icon}</span>
          <div><h3 className="font-semibold text-foreground">{card.title}</h3>{card.toggleLabel && <p className="text-xs text-muted-foreground">{card.toggleLabel}</p>}</div>
        </div>
        {card.toggleKey && (
          <button onClick={() => handleToggle(card.toggleKey!)} className={`w-12 h-6 rounded-full transition-colors relative ${toggles[card.toggleKey] ? "bg-primary" : "bg-muted"}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform ${toggles[card.toggleKey] ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        )}
      </div>
      {card.toggleKey && <div className={`px-5 py-1.5 text-xs font-medium ${toggles[card.toggleKey] ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{toggles[card.toggleKey] ? "✅ Active" : "⏸️ Disabled"}</div>}
      <div className="p-5 space-y-4">
        {card.fields.map((field) => (
          <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-sm font-medium text-foreground min-w-[130px]">{field.label}</label>
            <input type={field.type || "text"} value={values[field.key] || ""} onChange={(e) => handleChange(field.key, e.target.value)} placeholder={field.placeholder}
              className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <button onClick={() => handleSave(card)} disabled={saving === card.title}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">{saving === card.title ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  );

  if (loading) return <p className="text-muted-foreground p-4">Loading...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-2">API & Login Credentials</h2>
      <p className="text-sm text-muted-foreground mb-6">Manage payment gateways, social logins and email settings.</p>
      <h3 className="text-lg font-semibold text-foreground mb-3">👤 Admin Account</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><AdminAccountCard /></div>
      <h3 className="text-lg font-semibold text-foreground mb-3">💰 Payment Gateway</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">{renderCard(CREDENTIAL_CARDS[0])}</div>
      <h3 className="text-lg font-semibold text-foreground mb-3">🔐 Social Login Providers</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">{CREDENTIAL_CARDS.slice(1).map(renderCard)}</div>
      <h3 className="text-lg font-semibold text-foreground mb-3">📱 SMS OTP (Mobile Login)</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">{renderCard(SMS_OTP_FIELDS)}</div>
      <h3 className="text-lg font-semibold text-foreground mb-3">📧 Email / SMTP Configuration</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{renderCard(SMTP_FIELDS)}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border"><span className="text-2xl">🧪</span><div><h3 className="font-semibold text-foreground">Test Email</h3><p className="text-xs text-muted-foreground">Send a test email to verify SMTP settings</p></div></div>
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2"><label className="text-sm font-medium text-foreground min-w-[130px]">Test Email To</label><input type="email" value={values["smtp_test_email"] || ""} onChange={(e) => handleChange("smtp_test_email", e.target.value)} placeholder="test@example.com" className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition" /></div>
            <p className="text-xs text-muted-foreground">Note: Test email will work after SMTP is configured and backend is deployed.</p>
            <div className="flex justify-end pt-2"><button disabled={!toggles["smtp_enabled"]} className="bg-cta text-cta-foreground px-6 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-50" onClick={() => toast({ title: "📧 Test email feature requires backend setup" })}>Send Test Email</button></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCredentials;
