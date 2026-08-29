import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, GripVertical, Stethoscope } from "lucide-react";

type Disease = { en: string; hi: string };

export const DEFAULT_DISEASES: Disease[] = [
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

const AdminConsultationDiseases = () => {
  const [list, setList] = useState<Disease[]>(DEFAULT_DISEASES);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "consultation_diseases").maybeSingle().then(({ data }) => {
      if (data?.value) {
        try {
          const v = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
          if (Array.isArray(v) && v.length) setList(v);
        } catch {}
      }
    });
  }, []);

  const update = (i: number, key: keyof Disease, val: string) =>
    setList(prev => prev.map((d, idx) => idx === i ? { ...d, [key]: val } : d));
  const add = () => setList([...list, { en: "", hi: "" }]);
  const remove = (i: number) => setList(list.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= list.length) return;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; setList(next);
  };

  const save = async () => {
    const clean = list.filter(d => d.en.trim());
    if (!clean.length) { toast({ title: "Add at least one disease", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("site_settings").upsert(
      { key: "consultation_diseases", value: JSON.stringify(clean), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✅ Diseases list updated" });
  };

  const reset = () => { if (confirm("Reset to defaults?")) setList(DEFAULT_DISEASES); };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" /> Consultation Diseases / Concerns</h2>
          <p className="text-xs text-muted-foreground mt-1">These appear in the consultation popup and form for users to choose from.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={reset} className="px-3 py-2 rounded-lg text-xs border border-border bg-card hover:bg-secondary">Reset</button>
          <button onClick={add} className="px-3 py-2 rounded-lg text-xs font-semibold bg-secondary text-foreground flex items-center gap-1 hover:bg-secondary/80"><Plus className="h-3.5 w-3.5" /> Add</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1 disabled:opacity-50"><Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}</button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        {list.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5 shrink-0">
              <button onClick={() => move(i, -1)} className="text-xs text-muted-foreground hover:text-foreground">▲</button>
              <button onClick={() => move(i, 1)} className="text-xs text-muted-foreground hover:text-foreground">▼</button>
            </div>
            <span className="text-xs font-mono text-muted-foreground w-6">{i + 1}</span>
            <input value={d.en} onChange={e => update(i, "en", e.target.value)} placeholder="English label"
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <input value={d.hi} onChange={e => update(i, "hi", e.target.value)} placeholder="हिंदी"
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <button onClick={() => remove(i)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No items. Click <b>Add</b> to start.</p>}
      </div>
    </div>
  );
};

export default AdminConsultationDiseases;
