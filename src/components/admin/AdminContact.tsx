import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Save, Phone, Mail, MapPin, Map, Image as ImageIcon, Upload, X, Plus, Trash2 } from "lucide-react";

const FIELDS: { key: string; label: string; placeholder: string; Icon: any; multiline?: boolean }[] = [
  { key: "store_phone", label: "Phone Number (main)", placeholder: "+91 98765 43210", Icon: Phone },
  { key: "store_email", label: "Email Address (main)", placeholder: "support@vedicupchar.com", Icon: Mail },
  { key: "store_address", label: "Address (main)", placeholder: "123 Ayurveda Lane, New Delhi", Icon: MapPin, multiline: true },
  { key: "store_map_url", label: "Google Maps Embed URL (main)", placeholder: "Paste iframe HTML OR https://www.google.com/maps/embed?...", Icon: Map },
  { key: "contact_hero_title", label: "Contact Page Title", placeholder: "Contact Us", Icon: Mail },
  { key: "contact_hero_subtitle", label: "Contact Page Subtitle", placeholder: "We'd love to hear from you!", Icon: Mail, multiline: true },
];

type Branch = { name: string; phone: string; email: string; address: string; map_url: string };
const emptyBranch = (): Branch => ({ name: "", phone: "", email: "", address: "", map_url: "" });

const AdminContact = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingHero, setUploadingHero] = useState(false);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const keys = [...FIELDS.map(f => f.key), "contact_hero_image", "contact_branches"];
      const { data } = await supabase.from("site_settings").select("key, value").in("key", keys);
      const map: Record<string, string> = {};
      (data || []).forEach(d => { map[d.key] = d.value || ""; });
      setValues(map);
      try {
        const parsed = map['contact_branches'] ? JSON.parse(map['contact_branches']) : [];
        setBranches(Array.isArray(parsed) ? parsed : []);
      } catch { setBranches([]); }
      setLoading(false);
    })();
  }, []);

  const save = async (key: string, valueOverride?: string) => {
    setSaving(key);
    const { error } = await supabase.from("site_settings").upsert(
      { key, value: valueOverride !== undefined ? valueOverride : (values[key] || ""), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    setSaving(null);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "✅ Saved" });
  };

  const saveBranches = async (next?: Branch[]) => {
    const payload = next ?? branches;
    setSaving("branches");
    const { error } = await supabase.from("site_settings").upsert(
      { key: "contact_branches", value: JSON.stringify(payload), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    setSaving(null);
    if (error) toast({ title: "Branches save failed", description: error.message, variant: "destructive" });
    else toast({ title: "✅ Branches saved" });
  };

  const saveAll = async () => {
    setSaving("all");
    const keys = [...FIELDS.map(f => f.key), "contact_hero_image"];
    const rows = keys.map(k => ({ key: k, value: values[k] || "", updated_at: new Date().toISOString() }));
    rows.push({ key: "contact_branches", value: JSON.stringify(branches), updated_at: new Date().toISOString() });
    const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
    setSaving(null);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "✅ All contact details + branches saved" });
  };

  const updateBranch = (i: number, patch: Partial<Branch>) => {
    setBranches(prev => prev.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  };
  const addBranch = () => setBranches(prev => [...prev, emptyBranch()]);
  const removeBranch = (i: number) => {
    if (!confirm("Remove this branch?")) return;
    const next = branches.filter((_, idx) => idx !== i);
    setBranches(next);
    saveBranches(next);
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) { toast({ title: "Only PNG, JPG, JPEG, WEBP allowed", variant: "destructive" }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Max 5MB allowed", variant: "destructive" }); return; }
    setUploadingHero(true);
    const fileName = `contact-hero-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(fileName, file, { contentType: file.type });
    if (error) { setUploadingHero(false); toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
    const url = urlData.publicUrl;
    setValues(v => ({ ...v, contact_hero_image: url }));
    await supabase.from("site_settings").upsert({ key: "contact_hero_image", value: url, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setUploadingHero(false);
    toast({ title: "✅ Hero image updated" });
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-foreground mb-1">📞 Contact Us Page</h2>
      <p className="text-sm text-muted-foreground mb-6">Edit contact details, map & branches shown on Contact page & footer.</p>

      <div className="bg-card rounded-xl border border-border p-5 space-y-5">
        {/* Hero Image */}
        <div>
          <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-1.5">
            <ImageIcon className="h-4 w-4 text-primary" /> Hero / Banner Image (shown at top of Contact page)
          </label>
          <div className="flex gap-2">
            <input value={values['contact_hero_image'] || ""} placeholder="https://... or upload"
              onChange={e => setValues({ ...values, contact_hero_image: e.target.value })}
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <button onClick={() => heroInputRef.current?.click()} disabled={uploadingHero}
              className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-2 rounded-lg text-sm hover:bg-muted disabled:opacity-50">
              <Upload className="h-4 w-4" /> {uploadingHero ? "..." : "Upload"}
            </button>
            <button onClick={() => save("contact_hero_image")} disabled={saving === "contact_hero_image"}
              className="bg-secondary text-secondary-foreground px-3 py-2 rounded-lg text-sm hover:bg-muted disabled:opacity-50">
              {saving === "contact_hero_image" ? "..." : "Save"}
            </button>
            <input ref={heroInputRef} type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={handleHeroUpload} />
          </div>
          {values['contact_hero_image'] && (
            <div className="relative mt-2 inline-block">
              <img loading="lazy" decoding="async" src={values['contact_hero_image']} alt="Hero preview" className="h-28 w-full max-w-xs rounded-lg border border-border object-cover" />
              <button onClick={() => { setValues(v => ({ ...v, contact_hero_image: "" })); save("contact_hero_image", ""); }}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded p-0.5"><X className="h-3 w-3" /></button>
            </div>
          )}
        </div>

        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-1.5">
              <f.Icon className="h-4 w-4 text-primary" /> {f.label}
            </label>
            <div className="flex gap-2">
              {f.multiline ? (
                <textarea rows={2} value={values[f.key] || ""} placeholder={f.placeholder}
                  onChange={e => setValues({ ...values, [f.key]: e.target.value })}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background resize-none" />
              ) : (
                <input value={values[f.key] || ""} placeholder={f.placeholder}
                  onChange={e => setValues({ ...values, [f.key]: e.target.value })}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              )}
              <button onClick={() => save(f.key)} disabled={saving === f.key}
                className="bg-secondary text-secondary-foreground px-3 py-2 rounded-lg text-sm hover:bg-muted transition disabled:opacity-50">
                {saving === f.key ? "..." : "Save"}
              </button>
            </div>
            {f.key === "store_map_url" && (
              <p className="text-[11px] text-muted-foreground mt-1">
                💡 Google Maps → Share → Embed a map → poora iframe HTML copy karke yahan paste kar do. Hum auto src extract kar lenge.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Branches */}
      <div className="bg-card rounded-xl border border-border p-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-foreground">🏬 Branches / Multi Locations</h3>
            <p className="text-xs text-muted-foreground">Add 2-3+ branches with map. Contact page par alag-alag cards me show honge.</p>
          </div>
          <button onClick={addBranch} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Add Branch
          </button>
        </div>
        <div className="space-y-4">
          {branches.length === 0 && <p className="text-sm text-muted-foreground">No branches yet. Click "Add Branch".</p>}
          {branches.map((b, i) => (
            <div key={i} className="border border-border rounded-lg p-4 space-y-2 bg-background">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary">Branch #{i + 1}</span>
                <button onClick={() => removeBranch(i)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input placeholder="Branch name (e.g. Delhi HQ)" value={b.name} onChange={e => updateBranch(i, { name: e.target.value })}
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-card" />
                <input placeholder="Phone" value={b['phone']} onChange={e => updateBranch(i, { phone: e.target.value })}
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-card" />
                <input placeholder="Email (optional)" value={b.email} onChange={e => updateBranch(i, { email: e.target.value })}
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-card sm:col-span-2" />
                <textarea rows={2} placeholder="Full address" value={b.address} onChange={e => updateBranch(i, { address: e.target.value })}
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-card sm:col-span-2 resize-none" />
                <textarea rows={2} placeholder="Google Maps iframe HTML or embed URL" value={b.map_url} onChange={e => updateBranch(i, { map_url: e.target.value })}
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-card sm:col-span-2 resize-none font-mono text-xs" />
              </div>
            </div>
          ))}
        </div>
        {branches.length > 0 && (
          <button onClick={() => saveBranches()} disabled={saving === "branches"}
            className="mt-4 w-full bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {saving === "branches" ? "Saving branches..." : "💾 Save Branches"}
          </button>
        )}
      </div>

      <button onClick={saveAll} disabled={saving === "all"}
        className="mt-6 w-full bg-primary text-primary-foreground px-4 py-3 rounded-lg text-sm font-bold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
        <Save className="h-4 w-4" />
        {saving === "all" ? "Saving..." : "Save All Changes"}
      </button>
    </div>
  );
};

export default AdminContact;
