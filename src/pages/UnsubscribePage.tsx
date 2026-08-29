import { useEffect, useState } from "react";
import { useSearchParams } from "@/hooks/use-search-params";
import { supabase } from "@/lib/supabase";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const UnsubscribePage = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"checking" | "valid" | "invalid" | "already" | "submitting" | "done" | "error">("checking");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) { setState("invalid"); setMsg("Missing token."); return; }
    // In the standalone build unsubscribe validation happens on POST confirm;
    // presenting the confirmation is safe as soon as a token is present.
    setState("valid");
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) throw error;
      if (data?.success) setState("done");
      else if (data?.reason === "already_unsubscribed") setState("already");
      else { setState("error"); setMsg(data?.error || "Failed."); }
    } catch (e: any) { setState("error"); setMsg(e.message || "Failed"); }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar /><SiteHeader />
      <div className="container mx-auto px-4 py-16 max-w-md">
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          {state === "checking" && (<><Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" /><p>Verifying...</p></>)}
          {state === "valid" && (
            <>
              <h2 className="text-xl font-bold mb-2">Unsubscribe from emails?</h2>
              <p className="text-muted-foreground text-sm mb-6">You will stop receiving emails from Vedic Upchar.</p>
              <button onClick={confirm} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold text-sm">Confirm Unsubscribe</button>
            </>
          )}
          {state === "submitting" && (<><Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" /><p>Processing...</p></>)}
          {state === "done" && (<><CheckCircle className="h-14 w-14 text-primary mx-auto mb-4" /><h2 className="text-xl font-bold mb-1">Unsubscribed</h2><p className="text-muted-foreground text-sm">You will no longer receive emails.</p></>)}
          {state === "already" && (<><CheckCircle className="h-14 w-14 text-primary mx-auto mb-4" /><h2 className="text-xl font-bold mb-1">Already unsubscribed</h2><p className="text-muted-foreground text-sm">This email is already removed.</p></>)}
          {state === "invalid" && (<><XCircle className="h-14 w-14 text-destructive mx-auto mb-4" /><h2 className="text-xl font-bold mb-1">Invalid link</h2><p className="text-muted-foreground text-sm">{msg}</p></>)}
          {state === "error" && (<><XCircle className="h-14 w-14 text-destructive mx-auto mb-4" /><h2 className="text-xl font-bold mb-1">Something went wrong</h2><p className="text-muted-foreground text-sm">{msg}</p></>)}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
};

export default UnsubscribePage;
