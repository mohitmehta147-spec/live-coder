import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { resetCountdownCache } from "@/components/ProductCountdown";

const AdminSettings = () => {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("site_settings").select("*").order("key");
      setSettings(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async (id: string, key: string) => {
    if (edited[key] !== undefined) {
      const { error } = await supabase.from("site_settings").update({ value: edited[key], updated_at: new Date().toISOString() }).eq("id", id);
      if (!error) {
        setSettings(settings.map((s) => s.id === id ? { ...s, value: edited[key] } : s));
        const { [key]: _, ...rest } = edited;
        setEdited(rest);
        if (key === "countdown_enabled") resetCountdownCache();
        toast({ title: "✅ Setting saved!" });
      } else {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
      }
    }
  };

  const toggleSetting = async (id: string, key: string, currentValue: string) => {
    const newValue = currentValue === "true" ? "false" : "true";
    const { error } = await supabase.from("site_settings").update({ value: newValue, updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) {
      setSettings(settings.map((s) => s.id === id ? { ...s, value: newValue } : s));
      if (key === "countdown_enabled") resetCountdownCache();
      toast({ title: `✅ ${key} set to ${newValue}` });
    }
  };

  const isBooleanSetting = (value: string) => value === "true" || value === "false";

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Site Settings</h2>
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        {loading ? <p className="text-muted-foreground">Loading...</p> :
        settings.length === 0 ? <p className="text-muted-foreground">No settings found</p> :
        settings.map((s) => (
          <div key={s.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-3 rounded-lg hover:bg-muted/50 transition">
            <div className="min-w-[180px]">
              <p className="font-medium text-sm text-foreground">{s.key}</p>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </div>
            {isBooleanSetting(s.value) ? (
              <button onClick={() => toggleSetting(s.id, s.key, s.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  s.value === "true" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground"
                }`}>
                {s.value === "true" ? "✅ ON" : "❌ OFF"}
              </button>
            ) : (
              <>
                <input value={edited[s.key] !== undefined ? edited[s.key] : s.value || ""} onChange={(e) => setEdited({ ...edited, [s.key]: e.target.value })}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background" />
                <button onClick={() => handleSave(s.id, s.key)} disabled={edited[s.key] === undefined}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50">Save</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminSettings;