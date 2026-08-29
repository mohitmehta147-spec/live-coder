import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { RotateCcw, ChevronRight, CheckCircle2, Package, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";

const ReturnRequestPage = () => {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [step, setStep] = useState<"lookup" | "form" | "success">("lookup");
  const [orderLookup, setOrderLookup] = useState({ order_number: "", phone: "" });
  const [foundOrder, setFoundOrder] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [form, setForm] = useState({
    reason: "",
    return_type: "return",
    product_details: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleLookup = async () => {
    if (!orderLookup.order_number.trim() || !orderLookup['phone'].trim()) {
      toast({ title: t("Please enter order number and phone", "कृपया ऑर्डर नंबर और फोन दर्ज करें"), variant: "destructive" });
      return;
    }
    setLookupLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("order_number", orderLookup.order_number.trim().toUpperCase())
      .eq("customer_phone", orderLookup['phone'].trim())
      .single();
    setLookupLoading(false);

    if (error || !data) {
      toast({ title: t("Order not found", "ऑर्डर नहीं मिला"), description: t("Check order number and phone", "ऑर्डर नंबर और फोन चेक करें"), variant: "destructive" });
      return;
    }
    setFoundOrder(data);
    setStep("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reason.trim()) {
      toast({ title: t("Please enter reason", "कृपया कारण दर्ज करें"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("returns" as any).insert({
      order_id: foundOrder.id,
      order_number: foundOrder.order_number,
      customer_name: foundOrder.customer_name,
      customer_phone: foundOrder.customer_phone,
      customer_email: foundOrder.customer_email || null,
      reason: form.reason,
      return_type: form.return_type,
      product_details: form.product_details || null,
      status: "pending",
    });
    setSubmitting(false);

    if (error) {
      toast({ title: t("Submission failed", "सबमिट विफल"), description: error.message, variant: "destructive" });
      return;
    }
    setStep("success");
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <SiteHeader />

      <div className="bg-muted/50 border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">{t("Home", "होम")}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{t("Return / Exchange", "वापसी / बदलाव")}</span>
          </div>
        </div>
      </div>

      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4 max-w-lg">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              {t("Return / Exchange Request", "वापसी / बदलाव अनुरोध")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("Submit your return or exchange request easily", "अपना रिटर्न या एक्सचेंज अनुरोध आसानी से सबमिट करें")}
            </p>
          </div>

          {/* Step 1: Order Lookup */}
          {step === "lookup" && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
              <h3 className="font-semibold flex items-center gap-2 text-foreground">
                <Search className="h-4 w-4 text-primary" />
                {t("Find Your Order", "अपना ऑर्डर खोजें")}
              </h3>
              <p className="text-xs text-muted-foreground">{t("Enter your order number and registered phone number", "अपना ऑर्डर नंबर और रजिस्टर्ड फोन नंबर दर्ज करें")}</p>
              <input
                placeholder={t("Order Number (e.g. VU-20260401-1234)", "ऑर्डर नंबर (जैसे VU-20260401-1234)")}
                value={orderLookup.order_number}
                onChange={e => setOrderLookup({ ...orderLookup, order_number: e.target.value })}
                className="w-full px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none uppercase"
              />
              <input
                placeholder={t("Phone Number *", "फोन नंबर *")}
                value={orderLookup['phone']}
                onChange={e => setOrderLookup({ ...orderLookup, phone: e.target.value })}
                type="tel"
                className="w-full px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleLookup}
                disabled={lookupLoading}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-50"
              >
                {lookupLoading ? "..." : t("Find Order", "ऑर्डर खोजें")}
              </button>
            </div>
          )}

          {/* Step 2: Return Form */}
          {step === "form" && foundOrder && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Order info card */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm text-foreground">{t("Order", "ऑर्डर")}: {foundOrder.order_number}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>{t("Customer", "ग्राहक")}: {foundOrder.customer_name}</p>
                  <p>{t("Total", "कुल")}: ₹{foundOrder.total}</p>
                  <p>{t("Status", "स्थिति")}: {foundOrder.status}</p>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
                <h3 className="font-semibold text-foreground">{t("Return Details", "वापसी विवरण")}</h3>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("Request Type", "अनुरोध प्रकार")}</label>
                  <div className="flex gap-3">
                    {[
                      { key: "return", label: t("Return", "वापसी"), icon: "↩️" },
                      { key: "exchange", label: t("Exchange", "बदलाव"), icon: "🔄" },
                    ].map(opt => (
                      <button
                        type="button"
                        key={opt.key}
                        onClick={() => setForm({ ...form, return_type: opt.key })}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition ${
                          form.return_type === opt.key
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("Which product(s)?", "कौन सा प्रोडक्ट?")}</label>
                  <input
                    placeholder={t("Product name / details", "प्रोडक्ट का नाम / विवरण")}
                    value={form.product_details}
                    onChange={e => setForm({ ...form, product_details: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("Reason *", "कारण *")}</label>
                  <textarea
                    required
                    placeholder={t("Why do you want to return/exchange?", "आप वापसी/बदलाव क्यों चाहते हैं?")}
                    value={form.reason}
                    onChange={e => setForm({ ...form, reason: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-cta text-cta-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {submitting ? "..." : t("Submit Request", "अनुरोध सबमिट करें")}
                </button>
              </div>

              <button type="button" onClick={() => { setStep("lookup"); setFoundOrder(null); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition">
                {t("← Back to order lookup", "← ऑर्डर खोजने पर वापस जाएं")}
              </button>
            </form>
          )}

          {/* Step 3: Success */}
          {step === "success" && (
            <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-sm">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">
                {t("Request Submitted!", "अनुरोध सबमिट हो गया!")}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t("We'll review your request and contact you soon.", "हम आपके अनुरोध की समीक्षा करेंगे और जल्द ही संपर्क करेंगे।")}
              </p>
              <Link to="/" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition">
                {t("Back to Home", "होम पर वापस जाएं")}
              </Link>
            </div>
          )}

        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default ReturnRequestPage;
