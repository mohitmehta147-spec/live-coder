import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { consultationBannerDefaults } from "@/components/ConsultationBanner";
import { Save, RotateCcw } from "lucide-react";

const FIELDS: { key: keyof typeof consultationBannerDefaults; label: string; long?: boolean }[] = [
  { key: "eyebrow_en", label: "Eyebrow (EN)" },
  { key: "eyebrow_hi", label: "Eyebrow (HI)" },
  { key: "title_en", label: "Title (EN)", long: true },
  { key: "title_hi", label: "Title (HI)", long: true },
  { key: "description_en", label: "Description (EN)", long: true },
  { key: "description_hi", label: "Description (HI)", long: true },
  { key: "stat1_value", label: "Stat 1 Value" },
  { key: "stat1_label_en", label: "Stat 1 Label (EN)" },
  { key: "stat1_label_hi", label: "Stat 1 Label (HI)" },
  { key: "stat2_value", label: "Stat 2 Value" },
  { key: "stat2_label_en", label: "Stat 2 Label (EN)" },
  { key: "stat2_label_hi", label: "Stat 2 Label (HI)" },
  { key: "stat3_value", label: "Stat 3 Value" },
  { key: "stat3_label_en", label: "Stat 3 Label (EN)" },
  { key: "stat3_label_hi", label: "Stat 3 Label (HI)" },
  { key: "cta_en", label: "CTA Button (EN)" },
  { key: "cta_hi", label: "CTA Button (HI)" },
  { key: "phone", label: "Call Phone (e.g. +919876543210)" },
  { key: "side_title_en", label: "Side Card Title (EN)" },
  { key: "side_title_hi", label: "Side Card Title (HI)" },
  { key: "side_steps_en", label: "Side Steps (EN, separate with |)", long: true },
  { key: "side_steps_hi", label: "Side Steps (HI, separate with |)", long: true },
];

const AdminConsultationBanner = () => {
  const [cfg, setCfg] = useState(consultationBannerDefaults);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "consultation_banner").maybeSingle().then(({ data }) => {
      if (data?.value) {
        try { const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value; setCfg({ ...consultationBannerDefaults, ...parsed }); } catch {}
      }
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("site_settings").upsert(
      { key: "consultation_banner", value: JSON.stringify(cfg), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✅ Consultation Banner updated" });
  };

  const reset = () => {
    if (confirm("Reset all fields to defaults?")) setCfg(consultationBannerDefaults);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">Consultation Banner</h2>
        <div className="flex gap-2">
          <button onClick={reset} className="px-3 py-2 rounded-lg text-xs border border-border bg-card hover:bg-secondary flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1 disabled:opacity-50"><Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}</button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.long ? "md:col-span-2" : ""}>
            <label className="text-xs font-medium text-muted-foreground block mb-1">{f.label}</label>
            {f.long ? (
              <textarea value={(cfg as any)[f.key] || ""} onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value })}
                rows={2} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
            ) : (
              <input value={(cfg as any)[f.key] || ""} onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3">💡 For "Side Steps" use the <b>|</b> character to separate steps. Example: <code>Step one|Step two|Step three</code></p>
    </div>
  );
};

export default AdminConsultationBanner;
