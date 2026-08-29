import { supabase } from "@/lib/supabase";

type EventType = "signup" | "signin" | "popup" | "other";

export async function logLeadEvent(params: {
  event_type: EventType;
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  note?: string;
  user_id?: string | null;
}) {
  try {
    await (supabase as any).from("lead_events").insert({
      event_type: params.event_type,
      name: params.name || null,
      phone: (params.phone || "").replace(/\D/g, "") || null,
      email: params.email || null,
      city: params.city || null,
      note: params.note || null,
      user_id: params.user_id || null,
      status: "new",
    });
  } catch {
    /* silent */
  }
}
