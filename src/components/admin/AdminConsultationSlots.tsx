import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Clock, Save, Plus, Trash2, Ban, CheckCircle2 } from "lucide-react";

// Default time slots starting from 11 AM
const DEFAULT_SLOTS = [
  "11:00 AM", "11:15 AM", "11:30 AM", "11:45 AM",
  "12:00 PM", "12:15 PM", "12:30 PM", "12:45 PM",
  "2:00 PM", "2:15 PM", "2:30 PM", "2:45 PM",
  "3:00 PM", "3:15 PM", "3:30 PM", "3:45 PM",
  "4:00 PM", "4:15 PM", "4:30 PM", "4:45 PM",
  "5:00 PM", "5:15 PM", "5:30 PM", "5:45 PM",
];

const upsert = async (key: string, value: string) => {
  const { data: existing } = await supabase.from("site_settings").select("id").eq("key", key).maybeSingle();
  if (existing) return supabase.from("site_settings").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
  return supabase.from("site_settings").insert({ key, value });
};

const AdminConsultationSlots = () => {
  const { toast } = useToast();
  const [slots, setSlots] = useState<string[]>(DEFAULT_SLOTS);
  const [fullSlots, setFullSlots] = useState<string[]>([]); // entries: "YYYY-MM-DD|11:00 AM"
  const [newSlot, setNewSlot] = useState("");
  const [blockDate, setBlockDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("key, value")
        .in("key", ["consultation_slots", "consultation_full_slots"]);
      const m: Record<string, string> = {};
      (data || []).forEach((s: any) => { m[s.key] = s.value || ""; });
      try {
        if (m['consultation_slots']) setSlots(JSON.parse(m['consultation_slots']));
      } catch {}
      try {
        if (m['consultation_full_slots']) setFullSlots(JSON.parse(m['consultation_full_slots']));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const addSlot = () => {
    const v = newSlot.trim();
    if (!v) return;
    if (!/^(0?.[1-9]|1[0-2]):[0-5][0-9]\s*(AM|PM)$/i.test(v)) {
      toast({ title: "Format: e.g. 11:00 AM or 2:30 PM", variant: "destructive" });
      return;
    }
    const norm = v.toUpperCase();
    if (slots.includes(norm)) { toast({ title: "Slot already exists" }); return; }
    setSlots([...slots, norm]);
    setNewSlot("");
  };

  const removeSlot = (s: string) => setSlots(slots.filter(x => x !== s));

  const toggleFull = (slot: string) => {
    const key = `${blockDate}|${slot}`;
    setFullSlots(fullSlots.includes(key) ? fullSlots.filter(x => x !== key) : [...fullSlots, key]);
  };

  const isFull = (slot: string) => fullSlots.includes(`${blockDate}|${slot}`);

  const saveAll = async () => {
    setSaving(true);
    const r1 = await upsert("consultation_slots", JSON.stringify(slots));
    const r2 = await upsert("consultation_full_slots", JSON.stringify(fullSlots));
    setSaving(false);
    if ((r1 as any).error || (r2 as any).error) {
      toast({ title: "Save failed", variant: "destructive" });
    } else {
      toast({ title: "✅ Consultation slots saved!" });
    }
  };

  const resetDefaults = () => {
    if (!confirm("Reset slots to default (11 AM onwards)?")) return;
    setSlots(DEFAULT_SLOTS);
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" /> Consultation Slots
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage available time slots for doctor consultations. Slots start from 11 AM by default.
        </p>
      </div>

      {/* Slots list */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground">Available Time Slots ({slots.length})</h3>
          <button onClick={resetDefaults} className="text-xs text-muted-foreground hover:text-foreground underline">
            Reset to defaults
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
          {slots.map(s => (
            <div key={s} className="flex items-center justify-between gap-1 bg-muted rounded-lg px-3 py-2 text-sm">
              <span className="font-medium">{s}</span>
              <button onClick={() => removeSlot(s)} className="text-destructive hover:bg-destructive/10 rounded p-1" title="Remove slot">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newSlot}
            onChange={e => setNewSlot(e.target.value)}
            placeholder="e.g. 6:30 PM"
            className="flex-1 px-3 py-2 border-2 border-border rounded-lg text-sm bg-background focus:border-primary focus:outline-none"
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSlot())}
          />
          <button onClick={addSlot}
            className="flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {/* Mark slots as full per date */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
          <Ban className="h-4 w-4 text-destructive" /> Mark Slots As Full / Unavailable
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Pick a date, then click time slots to toggle them as <strong>FULL</strong>. Customers won't be able to book those.
        </p>
        <div className="flex items-center gap-2 mb-4">
          <label className="text-sm font-semibold">Date:</label>
          <input
            type="date"
            value={blockDate}
            onChange={e => setBlockDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="px-3 py-1.5 border-2 border-border rounded-lg text-sm bg-background focus:border-primary focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {slots.map(s => {
            const full = isFull(s);
            return (
              <button key={s} onClick={() => toggleFull(s)}
                className={`py-2 rounded-lg text-xs font-semibold border-2 transition ${
                  full
                    ? "bg-destructive/10 border-destructive text-destructive line-through"
                    : "border-border hover:border-primary text-foreground"
                }`}>
                {full && <Ban className="h-3 w-3 inline mr-1" />}
                {!full && <CheckCircle2 className="h-3 w-3 inline mr-1 text-green-600" />}
                {s}
              </button>
            );
          })}
        </div>
        {fullSlots.filter(x => x.startsWith(`${blockDate}|`)).length > 0 && (
          <p className="text-xs text-destructive mt-3">
            {fullSlots.filter(x => x.startsWith(`${blockDate}|`)).length} slot(s) marked FULL on {blockDate}
          </p>
        )}
      </div>

      <button onClick={saveAll} disabled={saving}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
        <Save className="h-4 w-4" />
        {saving ? "Saving..." : "Save All Settings"}
      </button>
    </div>
  );
};

export default AdminConsultationSlots;
