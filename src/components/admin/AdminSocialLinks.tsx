import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Save, Facebook, Instagram, Youtube, Twitter, MessageCircle, AtSign, Plus, Trash2, Link as LinkIcon } from "lucide-react";

type CustomLink = { label: string; url: string; icon?: string };

const FIXED = [
  { key: "facebook_url", label: "Facebook", icon: Facebook, color: "text-blue-600", placeholder: "https://facebook.com/yourpage" },
  { key: "instagram_url", label: "Instagram", icon: Instagram, color: "text-pink-600", placeholder: "https://instagram.com/yourpage" },
  { key: "youtube_url", label: "YouTube", icon: Youtube, color: "text-red-600", placeholder: "https://youtube.com/@yourchannel" },
  { key: "twitter_url", label: "X (Twitter)", icon: Twitter, color: "text-foreground", placeholder: "https://x.com/yourhandle" },
  { key: "whatsapp_url", label: "WhatsApp", icon: MessageCircle, color: "text-green-600", placeholder: "https://wa.me/91XXXXXXXXXX" },
  { key: "threads_url", label: "Threads", icon: AtSign, color: "text-foreground", placeholder: "https://threads.net/@yourhandle" },
];

const AdminSocialLinks = () => {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<CustomLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const keys = [...FIXED.map(f => f.key), "custom_social_links"];
      const { data } = await supabase.from("site_settings").select("key, value").in("key", keys);
      const map: Record<string, string> = {};
      let cust: CustomLink[] = [];
      (data || []).forEach(d => {
        if (d.key === "custom_social_links") {
          try { cust = JSON.parse(d.value || "[]"); } catch { cust = []; }
        } else {
          map[d.key] = d.value || "";
        }
      });
      setLinks(map);
      setCustom(Array.isArray(cust) ? cust : []);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const rows = [
      ...FIXED.map(f => ({ key: f.key, value: links[f.key] || "" })),
      { key: "custom_social_links", value: JSON.stringify(custom) },
    ].map(r => ({ ...r, updated_at: new Date().toISOString() }));

    const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Social links saved!" });
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Social Links</h2>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save All"}
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        {FIXED.map(f => {
          const Icon = f.icon;
          return (
            <div key={f.key} className="flex items-center gap-3">
              <Icon className={`h-5 w-5 ${f.color} shrink-0`} />
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">{f.label} URL</label>
                <input value={links[f.key] || ""} onChange={e => setLinks(l => ({ ...l, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card rounded-xl border border-border p-5 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Custom Links</h3>
          <button onClick={() => setCustom(c => [...c, { label: "", url: "", icon: "🔗" }])}
            className="flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Add Custom
          </button>
        </div>
        {custom.length === 0 ? (
          <p className="text-xs text-muted-foreground">No custom links. Add any social network like Telegram, Snapchat, Pinterest, etc.</p>
        ) : (
          <div className="space-y-2">
            {custom.map((c, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[60px_1fr_2fr_auto] gap-2 items-center">
                <input value={c.icon || ""} onChange={e => setCustom(arr => arr.map((x, idx) => idx === i ? { ...x, icon: e.target.value } : x))}
                  placeholder="🔗" maxLength={4}
                  className="px-2 py-2 border border-border rounded-lg text-sm bg-background text-center" />
                <input value={c.label} onChange={e => setCustom(arr => arr.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                  placeholder="Name (e.g. Telegram)"
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
                <input value={c.url} onChange={e => setCustom(arr => arr.map((x, idx) => idx === i ? { ...x, url: e.target.value } : x))}
                  placeholder="https://..."
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
                <button onClick={() => setCustom(arr => arr.filter((_, idx) => idx !== i))}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-lg">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSocialLinks;
