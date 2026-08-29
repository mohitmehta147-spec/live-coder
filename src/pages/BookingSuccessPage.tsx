import { useEffect } from "react";
import { useLocation, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Calendar, Clock, Phone, ArrowRight, Home } from "lucide-react";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useLanguage } from "@/contexts/LanguageContext";

const BookingSuccessPage = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state || {}) as {
    type?: string; date?: string; time?: string; mobile?: string; name?: string;
  };

  useEffect(() => {
    if (!state.type) navigate({ to: "/consultation", replace: true });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <TopBar /><SiteHeader />
      <section className="py-10 md:py-16">
        <div className="container mx-auto px-4 max-w-lg">
          <div className="bg-card border border-border rounded-3xl p-8 md:p-10 shadow-xl text-center relative overflow-hidden">
            {/* Animated tick */}
            <div className="relative mx-auto mb-6 w-24 h-24">
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-primary/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 className="h-20 w-20 text-primary drop-shadow-lg" strokeWidth={2.5} />
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              {t("Appointment Booked!", "अपॉइंटमेंट बुक हो गई!")}
            </h1>
            <p className="text-muted-foreground text-sm md:text-base mb-6">
              {t("We have received your consultation request. Our team will contact you shortly.",
                 "हमें आपकी परामर्श रिक्वेस्ट मिल गई है। हमारी टीम जल्द ही आपसे संपर्क करेगी।")}
            </p>

            {/* Details */}
            <div className="bg-muted/40 rounded-2xl p-4 text-left space-y-3 mb-6 border border-border">
              {state.name && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("Patient", "मरीज")}</span>
                  <span className="font-semibold text-foreground">{state.name}</span>
                </div>
              )}
              {state.type && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("Type", "प्रकार")}</span>
                  <span className="font-semibold text-foreground text-right">{state.type}</span>
                </div>
              )}
              {state.date && (
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{t("Date", "दिनांक")}</span>
                  <span className="font-semibold text-foreground">{state.date}</span>
                </div>
              )}
              {state.time && (
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{t("Time", "समय")}</span>
                  <span className="font-semibold text-foreground">{state.time}</span>
                </div>
              )}
              {state['mobile'] && (
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{t("Mobile", "मोबाइल")}</span>
                  <span className="font-semibold text-foreground">{state['mobile']}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Link to="/" className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition">
                <Home className="h-4 w-4" /> {t("Back to Home", "होम पर जाएं")}
              </Link>
              <Link to="/consultation" className="w-full inline-flex items-center justify-center gap-2 text-primary py-2.5 rounded-xl text-sm font-semibold hover:underline">
                {t("Book Another", "एक और बुक करें")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
};

export default BookingSuccessPage;
