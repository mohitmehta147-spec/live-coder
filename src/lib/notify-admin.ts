import { supabase } from "@/lib/supabase";

type Attachment = { name: string; url: string };

type NotifyArgs = {
  formType: string;
  subjectLine?: string;
  fields: Record<string, string | number | null | undefined>;
  attachments?: Attachment[];
  idempotencyKey?: string;
};

/**
 * Fire-and-forget admin notification email to vedicupchar11@gmail.com.
 * Never throws — failures are logged only.
 * Automatically appends Date, Time and Page URL to every notification.
 */
export const notifyAdmin = async ({ formType, subjectLine, fields, attachments, idempotencyKey }: NotifyArgs) => {
  try {
    const now = new Date();
    const meta = {
      date: now.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }),
      time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
      page_url: typeof window !== "undefined" ? window.location.href : "",
    };
    const enriched = { ...fields, ...meta };
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "admin-notification",
        recipientEmail: "vedicupchar11@gmail.com",
        idempotencyKey: idempotencyKey || `${formType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        templateData: { formType, subjectLine, fields: enriched, attachments: attachments || [], siteName: "Vedic Upchar" },
      },
    });
  } catch (e) {
    console.warn("notifyAdmin failed:", e);
  }
};
