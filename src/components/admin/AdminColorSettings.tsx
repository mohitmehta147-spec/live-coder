import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const colorSettings = [
  { key: "primary_color", label: "Primary Color", desc: "Main brand color (header, buttons)" },
  { key: "accent_color", label: "Accent/CTA Color", desc: "Call-to-action buttons" },
  { key: "secondary_color", label: "Secondary Color", desc: "Secondary elements" },
  { key: "topbar_bg_color", label: "Top Bar Color", desc: "Announcement bar" },
  { key: "footer_bg_color", label: "Footer Color", desc: "Footer background" },
  { key: "button_color", label: "Button Color", desc: "Buy Now / CTA buttons" },
  { key: "gradient_start", label: "Gradient Start", desc: "Gradient start color" },
  { key: "gradient_end", label: "Gradient End", desc: "Gradient end color" },
  { key: "gradient_direction", label: "Gradient Direction", desc: "e.g. 135deg, to right, to bottom" },
];

const AdminColorSettings = () => {
  const [settings, setSettings] = useState<Record<string, { id: string; value: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.from("site_settings").select("*").order("key").then(({ data }) => {
      const map: Record<string, { id: string; value: string }> = {};
      (data || []).forEach((s: any) => { map[s.key] = { id: s.id, value: s.value || "" }; });
      setSettings(map);
      setLoading(false);
    });
  }, []);

  const updateSetting = (key: string, value: string) => {
    setSettings({ ...settings, [key]: { ...settings[key], value } });
    setSaved(false);
  };

  const saveAll = async () => {
    for (const cs of colorSettings) {
      const val = settings[cs.key]?.value || "";
      if (settings[cs.key]?.id) {
        await supabase.from("site_settings").update({ value: val, updated_at: new Date().toISOString() }).eq("id", settings[cs.key].id);
      } else {
        const { data } = await supabase.from("site_settings").insert([{ key: cs.key, value: val }]).select("id").single();
        if (data?.id) setSettings(prev => ({ ...prev, [cs.key]: { id: data.id, value: val } }));
      }
    }
    window.dispatchEvent(new Event("theme-updated"));
    setSaved(true);
    toast({ title: "✅ Colors saved successfully!" });
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  const gradStart = settings["gradient_start"]?.value || "#2a9d8f";
  const gradEnd = settings["gradient_end"]?.value || "#264653";
  const gradDir = settings["gradient_direction"]?.value || "135deg";

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Color & Gradient Settings</h2>
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h3 className="font-semibold text-foreground mb-3">Live Preview</h3>
        <div className="flex gap-4 flex-wrap">
          {colorSettings.filter(c => c.key !== "gradient_direction").map((cs) => {
            const val = settings[cs.key]?.value || "#000";
            return (
              <div key={cs.key} className="text-center">
                <div className="w-12 h-12 rounded-lg border border-border mb-1" style={{ backgroundColor: val }} />
                <p className="text-[10px] text-muted-foreground">{cs.label}</p>
              </div>
            );
          })}
          <div className="text-center">
            <div className="w-24 h-12 rounded-lg border border-border mb-1" style={{ background: `linear-gradient(${gradDir}, ${gradStart}, ${gradEnd})` }} />
            <p className="text-[10px] text-muted-foreground">Gradient</p>
          </div>
        </div>
      </div>
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        {colorSettings.map((cs) => (
          <div key={cs.key} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="min-w-[180px]">
              <p className="font-medium text-sm text-foreground">{cs.label}</p>
              <p className="text-xs text-muted-foreground">{cs.desc}</p>
            </div>
            {cs.key === "gradient_direction" ? (
              <select value={settings[cs.key]?.value || "135deg"} onChange={(e) => updateSetting(cs.key, e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
                <option value="135deg">135° (Diagonal)</option>
                <option value="to right">Left to Right</option>
                <option value="to bottom">Top to Bottom</option>
                <option value="45deg">45° (Diagonal Up)</option>
                <option value="to bottom right">To Bottom Right</option>
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <input type="color" value={settings[cs.key]?.value || "#000000"} onChange={(e) => updateSetting(cs.key, e.target.value)}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5" />
                <input value={settings[cs.key]?.value || ""} onChange={(e) => updateSetting(cs.key, e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-background w-32" placeholder="#hex" />
              </div>
            )}
          </div>
        ))}
        <button onClick={saveAll}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition">
          {saved ? "✓ Saved!" : "Save All Colors"}
        </button>
      </div>
    </div>
  );
};

export default AdminColorSettings;
