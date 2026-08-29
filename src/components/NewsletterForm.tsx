import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check } from "lucide-react";
import { notifyAdmin } from "@/lib/notify-admin";

const NewsletterForm = ({ source = "footer" }: { source?: string }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await (supabase as any).from("newsletter_subscribers").insert({ email: trimmed, source });
    setLoading(false);
    if (error && !String(error.message || "").includes("duplicate")) {
      toast({ title: "Subscription failed", description: error.message, variant: "destructive" });
      return;
    }
    setDone(true);
    setEmail("");
    notifyAdmin({ formType: "Newsletter / Blog Subscription", fields: { email: trimmed, source } });
    toast({ title: "✅ Subscribed!", description: "Thank you for subscribing." });
  };

  return (
    <form onSubmit={submit} className="mt-4 flex w-full max-w-full">
      <input
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Your email"
        disabled={done}
        className="min-w-0 flex-1 bg-footer-foreground/10 px-3 py-2 rounded-l-lg text-sm placeholder:text-footer-foreground/40 outline-none disabled:opacity-60"
      />
      <button type="submit" disabled={loading || done}
        className="shrink-0 bg-primary text-primary-foreground px-4 py-2 rounded-r-lg text-sm font-semibold flex items-center gap-1 disabled:opacity-70">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : "Subscribe"}
      </button>
    </form>

  );
};
export default NewsletterForm;
