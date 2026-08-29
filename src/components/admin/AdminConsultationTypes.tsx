import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, ArrowUp, ArrowDown, Upload } from "lucide-react";
import { compressImage, imageLoads } from "@/lib/imageCompress";

export type ConsultationType = {
  name: string; nameHi: string; price: number; mrp: number; duration: string; icon: string;
  description?: string; descriptionHi?: string;
  /** Inactive types stay in the DB but are hidden on the public page. */
  active?: boolean;
};

export const defaultConsultationTypes: ConsultationType[] = [
  { name: "Diet and Nutrition", nameHi: "आहार और पोषण", price: 300, mrp: 500, duration: "15 min", icon: "🥗", description: "Personalized diet plans to help you achieve your health goals naturally.", descriptionHi: "स्वाभाविक रूप से स्वास्थ्य लक्ष्य पाने के लिए व्यक्तिगत आहार योजनाएँ।" },
  { name: "Diabetic Wellness", nameHi: "डायबिटिक वेलनेस", price: 300, mrp: 500, duration: "15 min", icon: "💉", description: "Manage blood sugar levels with ayurvedic and lifestyle guidance.", descriptionHi: "आयुर्वेदिक और जीवनशैली मार्गदर्शन से शुगर नियंत्रित करें।" },
  { name: "Hair & Skin Care", nameHi: "बाल और त्वचा देखभाल", price: 300, mrp: 500, duration: "15 min", icon: "✨", description: "Solutions for hair fall, dandruff, acne, pigmentation and glowing skin.", descriptionHi: "बालों का झड़ना, डैंड्रफ, मुहांसे और चमकती त्वचा के लिए समाधान।" },
  { name: "Joint & Pain Care", nameHi: "जोड़ और दर्द देखभाल", price: 300, mrp: 500, duration: "15 min", icon: "🦴", description: "Relief from joint pain, arthritis, back pain and stiffness.", descriptionHi: "जोड़ों के दर्द, गठिया, पीठ दर्द और अकड़न से राहत।" },
  { name: "Women's Health", nameHi: "महिला स्वास्थ्य", price: 300, mrp: 500, duration: "15 min", icon: "👩", description: "PCOD, PCOS, hormonal balance, thyroid and menstrual health.", descriptionHi: "PCOD, PCOS, हार्मोनल संतुलन, थायरॉइड और मासिक धर्म स्वास्थ्य।" },
  { name: "General Wellness", nameHi: "सामान्य स्वास्थ्य", price: 300, mrp: 500, duration: "15 min", icon: "💪", description: "Overall body wellness, immunity boost and lifestyle improvement.", descriptionHi: "समग्र शरीर स्वास्थ्य, प्रतिरक्षा बूस्ट और जीवनशैली सुधार।" },
];

export type Review = { name: string; text: string; textHi: string; rating: number };

export type SpecialConfig = {
  active: boolean;
  name: string; nameHi: string;
  subtitle: string; subtitleHi: string;
  tagline: string; taglineHi: string;
  price: number; mrp: number; duration: string;
  photoUrl: string;
  experience: string; experienceHi: string;
  clients: string; clientsHi: string;
  rating: string; reviewsCount: string;
  prepaidOnly: boolean;
  reviews: Review[];
};

export const DEFAULT_SPECIAL: SpecialConfig = {
  active: true,
  name: "ANIL BANSAL", nameHi: "अनिल बंसल",
  subtitle: "Yoga & Naturopathy Expert", subtitleHi: "योग एवं प्राकृतिक चिकित्सा विशेषज्ञ",
  tagline: "Healing Naturally, Living Better", taglineHi: "प्राकृतिक उपचार, बेहतर जीवन",
  price: 499, mrp: 1500, duration: "30 min", photoUrl: "",
  experience: "24+ Years", experienceHi: "24+ वर्ष",
  clients: "10K+ Happy Clients", clientsHi: "10हज़ार+ खुश ग्राहक",
  rating: "4.9", reviewsCount: "2.5K+",
  prepaidOnly: true,
  reviews: [
    { name: "Priya Sharma", text: "Anil sir's guidance changed my lifestyle completely. I feel more energetic and healthy than ever before.", textHi: "अनिल सर के मार्गदर्शन ने मेरी जीवनशैली पूरी तरह बदल दी। मैं पहले से कहीं अधिक ऊर्जावान हूँ।", rating: 5 },
    { name: "Rajesh Kumar", text: "Best consultation I ever had. Natural remedies actually work when done right.", textHi: "मैंने अब तक की सबसे अच्छी परामर्श। प्राकृतिक उपचार सही तरीके से करें तो वाकई काम करते हैं।", rating: 5 },
    { name: "Sunita Verma", text: "My PCOD issues improved significantly within 3 months. Highly recommend.", textHi: "मेरी PCOD समस्या 3 महीने में काफी ठीक हो गई। ज़रूर सलाह लें।", rating: 5 },
    { name: "Amit Gupta", text: "Yoga therapy helped me overcome chronic back pain. Truly grateful.", textHi: "योग चिकित्सा से पुराने पीठ दर्द से आराम मिला। बहुत आभारी हूँ।", rating: 5 },
    { name: "Meera Iyer", text: "Very knowledgeable and patient. Explains everything in detail.", textHi: "बहुत जानकार और धैर्यवान। हर चीज़ विस्तार से समझाते हैं।", rating: 5 },
    { name: "Vikram Singh", text: "Weight loss journey with sir's plan was smooth and healthy.", textHi: "सर की योजना से वजन घटाना आसान और स्वस्थ रहा।", rating: 5 },
  ],
};

const AdminConsultationTypes = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<ConsultationType[]>(defaultConsultationTypes);
  const [special, setSpecial] = useState<SpecialConfig>(DEFAULT_SPECIAL);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** Single source of truth = database. Always (re)read from it. */
  const load = async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("site_settings").select("key, value")
      .in("key", ["consultation_types", "anil_bansal_special"]);
    if (error) { setLoadError(error.message); setLoading(false); return; }
    const ct = data?.find((r: any) => r.key === "consultation_types");
    const sp = data?.find((r: any) => r.key === "anil_bansal_special");
    if (ct?.value) {
      try {
        const p = typeof ct.value === "string" ? JSON.parse(ct.value) : ct.value;
        if (Array.isArray(p) && p.length) setItems(p.map((x: any) => ({ ...x, active: x.active !== false })));
      } catch { /* keep defaults */ }
    }
    if (sp?.value) {
      try {
        const p = typeof sp.value === "string" ? JSON.parse(sp.value) : sp.value;
        setSpecial({ ...DEFAULT_SPECIAL, ...p, reviews: Array.isArray(p.reviews) && p.reviews.length ? p.reviews : DEFAULT_SPECIAL.reviews });
      } catch { /* keep defaults */ }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (i: number, patch: Partial<ConsultationType>) =>
    setItems(arr => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const remove = (i: number) => { if (confirm("Delete this consultation type?")) setItems(arr => arr.filter((_, idx) => idx !== i)); };
  const add = () => setItems(arr => [...arr, { name: "New Type", nameHi: "नया प्रकार", price: 300, mrp: 500, duration: "15 min", icon: "🩺", description: "", descriptionHi: "", active: true }]);
  const move = (i: number, dir: -1 | 1) => setItems(arr => {
    const next = [...arr]; const j = i + dir; if (j < 0 || j >= next.length) return arr;
    [next[i], next[j]] = [next[j], next[i]]; return next;
  });

  const photoRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const prepared = await compressImage(file, 900, 0.85);
      const fileName = `doctor-${Date.now()}.${prepared.ext}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, prepared.blob, { contentType: prepared.contentType });
      if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return; }
      const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
      const ok = await imageLoads(data.publicUrl);
      if (!ok) { toast({ title: "Image could not be read, try another file", variant: "destructive" }); return; }
      updSp({ photoUrl: data.publicUrl });
      toast({ title: "✅ Photo uploaded" });
    } finally {
      setPhotoUploading(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  };

  const updSp = (patch: Partial<SpecialConfig>) => setSpecial(s => ({ ...s, ...patch }));
  const updReview = (i: number, patch: Partial<Review>) =>
    setSpecial(s => ({ ...s, reviews: s.reviews.map((r, idx) => idx === i ? { ...r, ...patch } : r) }));
  const addReview = () => setSpecial(s => ({ ...s, reviews: [...s.reviews, { name: "New Reviewer", text: "", textHi: "", rating: 5 }] }));
  const removeReview = (i: number) => setSpecial(s => ({ ...s, reviews: s.reviews.filter((_, idx) => idx !== i) }));

  const save = async () => {
    setSaving(true);
    const payload = items.map(it => ({ ...it, active: it.active !== false }));
    const r1 = await supabase.from("site_settings").upsert(
      { key: "consultation_types", value: JSON.stringify(payload), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    const r2 = await supabase.from("site_settings").upsert(
      { key: "anil_bansal_special", value: JSON.stringify(special), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    const error = r1.error || r2.error;
    if (error) {
      setSaving(false);
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }

    // Verify the write actually landed in the database (catches silent
    // permission / duplicate-key problems instead of showing a fake success).
    const { data: check, error: checkErr } = await supabase
      .from("site_settings").select("value").eq("key", "consultation_types").maybeSingle();
    setSaving(false);
    if (checkErr) { toast({ title: "Saved, but could not verify", description: checkErr.message, variant: "destructive" }); return; }
    let stored: any[] = [];
    try { stored = JSON.parse((check as any)?.value || "[]"); } catch { /* ignore */ }
    if (!Array.isArray(stored) || stored.length !== payload.length) {
      toast({ title: "Save did not persist", description: "Database returned a different list. Please retry or re-login as admin.", variant: "destructive" });
      return;
    }
    setItems(stored.map((x: any) => ({ ...x, active: x.active !== false })));
    toast({ title: "✅ Saved to database", description: `${stored.length} consultation types stored.` });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">Consultation Types</h2>
        <div className="flex gap-2">
          <button onClick={add} className="px-3 py-2 rounded-lg text-xs font-semibold bg-secondary text-secondary-foreground flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Add Type</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground flex items-center gap-1 disabled:opacity-50"><Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save All"}</button>
          <button onClick={load} disabled={loading || saving} className="px-3 py-2 rounded-lg text-xs font-semibold border border-border disabled:opacity-50">{loading ? "Loading…" : "Reload"}</button>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not load from database: {loadError}
        </div>
      )}

      {/* Special: Anil Bansal */}
      <div className="bg-linear-to-br from-primary/5 to-cta/5 border border-cta/30 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-bold text-foreground">⭐ Special Consultation (Hero Banner)</h3>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={special.active} onChange={e => updSp({ active: e.target.checked })} className="h-4 w-4" /> Active</label>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={special.prepaidOnly} onChange={e => updSp({ prepaidOnly: e.target.checked })} className="h-4 w-4" /> Prepaid Only</label>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input value={special.name} onChange={e => updSp({ name: e.target.value })} placeholder="Name (EN)" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input value={special.nameHi} onChange={e => updSp({ nameHi: e.target.value })} placeholder="Name (HI)" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input value={special.subtitle} onChange={e => updSp({ subtitle: e.target.value })} placeholder="Subtitle (EN)" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input value={special.subtitleHi} onChange={e => updSp({ subtitleHi: e.target.value })} placeholder="Subtitle (HI)" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input value={special.tagline} onChange={e => updSp({ tagline: e.target.value })} placeholder="Tagline (EN)" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input value={special.taglineHi} onChange={e => updSp({ taglineHi: e.target.value })} placeholder="Tagline (HI)" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input value={special.experience} onChange={e => updSp({ experience: e.target.value })} placeholder="Experience (EN) e.g. 24+ Years" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input value={special.experienceHi} onChange={e => updSp({ experienceHi: e.target.value })} placeholder="Experience (HI)" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input value={special.clients} onChange={e => updSp({ clients: e.target.value })} placeholder="Clients (EN) e.g. 10K+ Happy Clients" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input value={special.clientsHi} onChange={e => updSp({ clientsHi: e.target.value })} placeholder="Clients (HI)" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input value={special.rating} onChange={e => updSp({ rating: e.target.value })} placeholder="Rating e.g. 4.9" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input value={special.reviewsCount} onChange={e => updSp({ reviewsCount: e.target.value })} placeholder="Reviews Count e.g. 2.5K+" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input type="number" value={special['mrp']} onChange={e => updSp({ mrp: Number(e.target.value) })} placeholder="MRP" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input type="number" value={special['price']} onChange={e => updSp({ price: Number(e.target.value) })} placeholder="Price" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input value={special.duration} onChange={e => updSp({ duration: e.target.value })} placeholder="Duration (e.g. 30 min)" className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <div className="flex gap-2">
            <input value={special.photoUrl} onChange={e => updSp({ photoUrl: e.target.value })} placeholder="Photo URL (or upload →)" className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <button type="button" onClick={() => photoRef.current?.click()} disabled={photoUploading}
              className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold flex items-center gap-1 disabled:opacity-50">
              {photoUploading ? "Uploading…" : <><Upload className="h-3.5 w-3.5" /> Upload</>}
            </button>
            <input ref={photoRef} type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={uploadPhoto} />
          </div>
        </div>
        {special.photoUrl && <img loading="lazy" decoding="async" src={special.photoUrl} alt="preview" className="w-20 h-20 rounded-full object-cover mt-3 border border-border" />}

        {/* Reviews */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">Reviews ({special.reviews.length})</p>
            <button onClick={addReview} className="text-xs px-2 py-1 rounded bg-secondary flex items-center gap-1"><Plus className="h-3 w-3" /> Add Review</button>
          </div>
          <div className="space-y-2">
            {special.reviews.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start bg-card border border-border rounded-lg p-2">
                <input value={r.name} onChange={e => updReview(i, { name: e.target.value })} placeholder="Name" className="col-span-4 sm:col-span-3 px-2 py-1.5 border border-border rounded text-xs bg-background" />
                <input value={r.text} onChange={e => updReview(i, { text: e.target.value })} placeholder="Review (EN)" className="col-span-8 sm:col-span-4 px-2 py-1.5 border border-border rounded text-xs bg-background" />
                <input value={r.textHi} onChange={e => updReview(i, { textHi: e.target.value })} placeholder="Review (HI)" className="col-span-9 sm:col-span-3 px-2 py-1.5 border border-border rounded text-xs bg-background" />
                <input type="number" min={1} max={5} value={r.rating} onChange={e => updReview(i, { rating: Number(e.target.value) })} className="col-span-2 sm:col-span-1 px-2 py-1.5 border border-border rounded text-xs bg-background text-center" />
                <button onClick={() => removeReview(i)} className="col-span-1 p-1.5 text-destructive hover:bg-destructive/10 rounded justify-self-end"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3 space-y-2">
            <div className="grid grid-cols-12 gap-2 items-center">
              <input value={it.icon} onChange={e => update(i, { icon: e.target.value })} className="col-span-2 sm:col-span-1 px-2 py-2 border border-border rounded-lg text-center text-lg bg-background" />
              <input value={it.name} onChange={e => update(i, { name: e.target.value })} placeholder="Name (EN)" className="col-span-10 sm:col-span-3 px-2 py-2 border border-border rounded-lg text-sm bg-background" />
              <input value={it.nameHi} onChange={e => update(i, { nameHi: e.target.value })} placeholder="Name (HI)" className="col-span-12 sm:col-span-3 px-2 py-2 border border-border rounded-lg text-sm bg-background" />
              <input type="number" value={it['mrp']} onChange={e => update(i, { mrp: Number(e.target.value) })} placeholder="MRP" className="col-span-4 sm:col-span-1 px-2 py-2 border border-border rounded-lg text-sm bg-background" />
              <input type="number" value={it['price']} onChange={e => update(i, { price: Number(e.target.value) })} placeholder="Price" className="col-span-4 sm:col-span-1 px-2 py-2 border border-border rounded-lg text-sm bg-background" />
              <input value={it.duration} onChange={e => update(i, { duration: e.target.value })} placeholder="Duration" className="col-span-4 sm:col-span-1 px-2 py-2 border border-border rounded-lg text-sm bg-background" />
              <div className="col-span-12 sm:col-span-2 flex justify-end items-center gap-1">
                <label className="flex items-center gap-1 text-[11px] font-semibold mr-1" title="Show on public consultation page">
                  <input type="checkbox" checked={it.active !== false} onChange={e => update(i, { active: e.target.checked })} className="h-3.5 w-3.5" /> Active
                </label>
                <button onClick={() => move(i, -1)} className="p-1.5 hover:bg-secondary rounded"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => move(i, 1)} className="p-1.5 hover:bg-secondary rounded"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(i)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <textarea value={it.description || ""} onChange={e => update(i, { description: e.target.value })} placeholder="Description (EN)" rows={2} className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background resize-none" />
              <textarea value={it.descriptionHi || ""} onChange={e => update(i, { descriptionHi: e.target.value })} placeholder="Description (HI)" rows={2} className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background resize-none" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3">💡 Changes take effect after Save. Users see MRP struck-through with the discount price.</p>
    </div>
  );
};

export default AdminConsultationTypes;
