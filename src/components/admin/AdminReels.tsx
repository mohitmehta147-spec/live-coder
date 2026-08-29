import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, Upload, Film, GripVertical } from "lucide-react";

type Reel = {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url?: string;
  product_slug?: string;
  is_active: boolean;
};

const newReel = (): Reel => ({
  id: Math.random().toString(36).slice(2, 10),
  title: "",
  video_url: "",
  thumbnail_url: "",
  product_slug: "",
  is_active: true,
});

const AdminReels = () => {
  const [reels, setReels] = useState<Reel[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const { toast } = useToast();
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const thumbInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("key, value").in("key", ["reels_config", "section_reels_enabled"]);
      const cfg = data?.find((r: any) => r.key === "reels_config");
      const en = data?.find((r: any) => r.key === "section_reels_enabled");
      if (en) setEnabled((en.value as any) !== "false" && (en.value as any) !== false);
      if (cfg?.value) {
        try {
          const v = typeof cfg.value === "string" ? JSON.parse(cfg.value) : cfg.value;
          if (Array.isArray(v)) setReels(v);
          else if (Array.isArray(v.items)) setReels(v.items);
        } catch {}
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error: e1 } = await (supabase as any).from("site_settings").upsert({ key: "reels_config", value: reels }, { onConflict: "key" });
    const { error: e2 } = await (supabase as any).from("site_settings").upsert({ key: "section_reels_enabled", value: enabled ? "true" : "false" }, { onConflict: "key" });
    setSaving(false);
    if (e1 || e2) toast({ title: "Save failed", description: (e1 || e2)?.message, variant: "destructive" });
    else toast({ title: "✅ Reels saved" });
  };

  const uploadFile = async (file: File, prefix: string): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `reels/${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return null; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };


  const handleVideo = async (id: string, f?: File | null) => {
    if (!f) return;
    setUploadingId(id);
    const url = await uploadFile(f, "video");
    setUploadingId(null);
    if (url) setReels(rs => rs.map(r => r.id === id ? { ...r, video_url: url } : r));
  };

  const handleThumb = async (id: string, f?: File | null) => {
    if (!f) return;
    const url = await uploadFile(f, "thumb");
    if (url) setReels(rs => rs.map(r => r.id === id ? { ...r, thumbnail_url: url } : r));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><Film className="h-5 w-5 text-rose-500" /> Reels & Shorts</h2>
          <p className="text-xs text-muted-foreground">Upload short videos to showcase products. Max ~50MB per video recommended.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="h-4 w-4" />
            Section visible on site
          </label>
          <button onClick={() => setReels(rs => [...rs, newReel()])} className="bg-secondary text-foreground px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 hover:bg-secondary/80">
            <Plus className="h-4 w-4" /> Add Reel
          </button>
          <button onClick={save} disabled={saving} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {reels.length === 0 && (
        <div className="border-2 border-dashed border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
          No reels yet. Click <span className="font-semibold">Add Reel</span> to upload your first short.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {reels.map((r, idx) => (
          <div key={r.id} className="bg-card border border-border rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1"><GripVertical className="h-3 w-3" /> #{idx + 1}</span>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={r.is_active} onChange={e => setReels(rs => rs.map(x => x.id === r.id ? { ...x, is_active: e.target.checked } : x))} className="h-3.5 w-3.5" />
                Active
              </label>
              <button onClick={() => setReels(rs => rs.filter(x => x.id !== r.id))} className="text-destructive hover:bg-destructive/10 rounded p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="relative aspect-[9/16] bg-muted rounded-lg overflow-hidden flex items-center justify-center">
              {(() => {
                const url = (r.video_url || "").trim();
                if (!url) return <div className="text-muted-foreground text-xs text-center px-3">No video uploaded</div>;
                const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
                const ig = url.match(/instagram\.com\/(?:reel|p)\/([\w-]+)/);
                let embed: string | null = null;
                if (yt) embed = `https://www.youtube.com/embed/${yt[1]}`;
                else if (ig) embed = `https://www.instagram.com/p/${ig[1]}/embed`;
                if (embed) {
                  return <iframe src={embed} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title={r.title || "reel"} />;
                }
                return <video src={url} poster={r.thumbnail_url} className="w-full h-full object-cover" controls playsInline preload="metadata" />;
              })()}
              {uploadingId === r.id && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-semibold">Uploading...</div>
              )}
            </div>


            <input
              type="text" placeholder="Title (e.g. Hair Growth in 30 days)" value={r.title}
              onChange={e => setReels(rs => rs.map(x => x.id === r.id ? { ...x, title: e.target.value } : x))}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
            />
            <input
              type="text" placeholder="Linked product slug (optional)" value={r.product_slug || ""}
              onChange={e => setReels(rs => rs.map(x => x.id === r.id ? { ...x, product_slug: e.target.value } : x))}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
            />

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => fileInputs.current[r.id]?.click()} className="flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-lg py-2 text-xs font-semibold hover:opacity-90">
                <Upload className="h-3.5 w-3.5" /> Video
              </button>
              <button onClick={() => thumbInputs.current[r.id]?.click()} className="flex items-center justify-center gap-1.5 bg-secondary text-foreground rounded-lg py-2 text-xs font-semibold hover:bg-secondary/80">
                <Upload className="h-3.5 w-3.5" /> Thumbnail
              </button>
              <input ref={el => { fileInputs.current[r.id] = el; }} type="file" accept="video/*" hidden onChange={e => handleVideo(r.id, e.target.files?.[0])} />
              <input ref={el => { thumbInputs.current[r.id] = el; }} type="file" accept="image/*" hidden onChange={e => handleThumb(r.id, e.target.files?.[0])} />
            </div>

            <input
              type="url" placeholder="Or paste video URL" value={r.video_url}
              onChange={e => setReels(rs => rs.map(x => x.id === r.id ? { ...x, video_url: e.target.value } : x))}
              className="w-full px-3 py-1.5 border border-border rounded-lg text-[11px] bg-background"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminReels;
