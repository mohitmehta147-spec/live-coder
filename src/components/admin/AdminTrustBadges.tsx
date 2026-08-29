import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Truck, ShieldCheck, RefreshCw, Headphones, Save } from "lucide-react";

const badgeIcons = ["🚚 Truck", "🛡️ Shield", "🔄 Refresh", "🎧 Headphones"];

const AdminTrustBadges = () => {
  const [badges, setBadges] = useState<Array<{ title: string; titleHi: string; subtitle: string; subtitleHi: string }>>([
    { title: "", titleHi: "", subtitle: "", subtitleHi: "" },
    { title: "", titleHi: "", subtitle: "", subtitleHi: "" },
    { title: "", titleHi: "", subtitle: "", subtitleHi: "" },
    { title: "", titleHi: "", subtitle: "", subtitleHi: "" },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("site_settings").select("key, value").like("key", "trust_badge_%");
      if (data && data.length > 0) {
        const map: Record<string, string> = {};
        data.forEach(d => { map[d.key] = d.value || ""; });
        setBadges([1, 2, 3, 4].map(i => ({
          title: map[`trust_badge_${i}_title`] || "",
          titleHi: map[`trust_badge_${i}_title_hi`] || "",
          subtitle: map[`trust_badge_${i}_subtitle`] || "",
          subtitleHi: map[`trust_badge_${i}_subtitle_hi`] || "",
        })));
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const updates = badges.flatMap((b, idx) => {
      const i = idx + 1;
      return [
        { key: `trust_badge_${i}_title`, value: b.title },
        { key: `trust_badge_${i}_title_hi`, value: b.titleHi },
        { key: `trust_badge_${i}_subtitle`, value: b.subtitle },
        { key: `trust_badge_${i}_subtitle_hi`, value: b.subtitleHi },
      ];
    });

    for (const u of updates) {
      await supabase.from("site_settings").update({ value: u.value, updated_at: new Date().toISOString() }).eq("key", u.key);
    }
    setSaving(false);
    toast({ title: "✅ Trust badges saved!" });
  };

  const updateBadge = (idx: number, field: string, value: string) => {
    setBadges(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Trust Badges</h2>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save All"}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {badges.map((badge, idx) => (
          <div key={idx} className="bg-card rounded-xl border border-border p-5 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{badgeIcons[idx]}</span>
              <h3 className="font-semibold text-foreground">Badge {idx + 1}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Title (EN)</label>
                <input value={badge.title} onChange={e => updateBadge(idx, "title", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Title (HI)</label>
                <input value={badge.titleHi} onChange={e => updateBadge(idx, "titleHi", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Subtitle (EN)</label>
                <input value={badge.subtitle} onChange={e => updateBadge(idx, "subtitle", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Subtitle (HI)</label>
                <input value={badge.subtitleHi} onChange={e => updateBadge(idx, "subtitleHi", e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminTrustBadges;
