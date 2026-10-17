import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

const REQUESTED_PIXEL_ID = "540309294846384";
const PREVIOUS_PIXEL_ID = "1488431869628508";

const AdminMetaPixel = () => {
  const [pixelId, setPixelId] = useState(REQUESTED_PIXEL_ID);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("id, key, value")
        .eq("key", "meta_pixel_id")
        .maybeSingle();

      if (!active) return;
      if (error) {
        toast({ title: "Pixel setting load nahi hui", description: error.message, variant: "destructive" });
      } else if (data?.value) {
        setPixelId(String(data.value));
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [toast]);

  const savePixelId = async () => {
    const cleanedId = pixelId.trim();
    if (!/^\d{10,20}$/.test(cleanedId)) {
      toast({ title: "Pixel ID check karein", description: "ID mein sirf 10 se 20 digits hone chahiye.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data: existing, error: readError } = await supabase
      .from("site_settings")
      .select("id")
      .eq("key", "meta_pixel_id")
      .maybeSingle();

    const result = readError
      ? { error: readError }
      : existing?.id
        ? await supabase.from("site_settings").update({ value: cleanedId, updated_at: new Date().toISOString() }).eq("id", existing.id)
        : await supabase.from("site_settings").insert({ key: "meta_pixel_id", value: cleanedId });

    setSaving(false);
    if (result.error) {
      toast({ title: "Pixel ID save nahi hui", description: result.error.message, variant: "destructive" });
      return;
    }

    setPixelId(cleanedId);
    toast({ title: "Pixel ID save ho gayi", description: "Tracking abhi review ke liye paused hai." });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Meta Pixel</h2>
          <p className="mt-1 text-sm text-muted-foreground">Facebook ads ke liye Pixel ID settings</p>
        </div>
        <Badge variant="secondary">Not installed</Badge>
      </div>

      <section className="rounded-md border border-border bg-card p-5 sm:p-6 space-y-5">
        <div className="space-y-2">
          <label htmlFor="meta-pixel-id" className="text-sm font-semibold text-foreground">Meta Pixel ID</label>
          <Input
            id="meta-pixel-id"
            inputMode="numeric"
            autoComplete="off"
            value={pixelId}
            onChange={(event) => setPixelId(event.target.value)}
            disabled={loading || saving}
            aria-describedby="meta-pixel-help"
          />
          <p id="meta-pixel-help" className="text-xs text-muted-foreground">
            Aapke bheje hue Meta code se ID bhari gayi hai. Save karne se sirf ID store hogi; website par tracking start nahi hogi.
          </p>
        </div>

        <Button onClick={savePixelId} disabled={loading || saving}>
          <Save />
          {saving ? "Saving…" : "Save Pixel ID"}
        </Button>
      </section>

      <Alert>
        <AlertTriangle />
          <AlertTitle>Health-related pages par Pixel tracking enable nahi ki gayi</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            Is website par health aur wellness products hain. Product page visit aur uska URL health-related interest bata sakte hain. Meta ke rules ke mutabik aisa data Pixel se nahi bhejna chahiye. Aapka ID save ho sakta hai, lekin yahan Pixel code add ya fire nahi hoga.
          </p>
          <p>
            Project files ke 142 product pages mein purana Pixel ID ({PREVIOUS_PIXEL_ID}) tha. Health-related product pages se woh code remove kiya gaya hai; uski jagah naya Pixel activate nahi hua.
          </p>
          <a
            href="https://www.facebook.com/legal/technology_terms"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
          >
            Meta Business Tools Terms <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default AdminMetaPixel;