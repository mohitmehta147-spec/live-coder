import { Link } from "@tanstack/react-router";
import { useSearchParams } from "@/hooks/use-search-params";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { CheckCircle, Package } from "lucide-react";

const OrderSuccessPage = () => {
  const [params] = useSearchParams();
  const orderId = params.get("id");
  const { t } = useLanguage();
  const [orderNumber, setOrderNumber] = useState<string>("");

  useEffect(() => {
    if (!orderId) return;
    supabase.from("orders").select("order_number").eq("id", orderId).maybeSingle().then(({ data }) => {
      if (data?.order_number) setOrderNumber(data.order_number);
    });
  }, [orderId]);

  const displayId = orderNumber || (orderId ? orderId.slice(0, 8).toUpperCase() : "");

  return (
    <div className="min-h-screen bg-background">
      <TopBar /><SiteHeader />
      <div className="container mx-auto px-4 py-20 text-center max-w-lg">
        <CheckCircle className="h-20 w-20 text-primary mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-3">{t("Order Placed Successfully!", "ऑर्डर सफलतापूर्वक प्लेस हो गया!")}</h1>
        <p className="text-muted-foreground mb-2">{t("Thank you for your order", "आपके ऑर्डर के लिए धन्यवाद")}</p>
        {displayId && (
          <div className="mb-6 bg-primary/5 border-2 border-primary/30 rounded-xl py-4 px-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t("Order ID", "ऑर्डर आईडी")}</p>
            <p className="text-2xl md:text-3xl font-mono font-extrabold text-primary break-all">{displayId}</p>
          </div>
        )}
        <div className="bg-muted/50 rounded-xl p-4 mb-6 flex items-center gap-3">
          <Package className="h-5 w-5 text-primary" />
          <p className="text-sm">{t("You will receive delivery within 3-5 business days", "आपको 3-5 कार्य दिवसों में डिलीवरी मिलेगी")}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/track-order" className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition text-center">
            {t("Track Your Order", "अपना ऑर्डर ट्रैक करें")}
          </Link>
          <Link to="/my-orders" className="flex-1 border-2 border-primary text-primary py-3 rounded-xl font-bold text-sm hover:bg-primary/5 transition text-center">
            {t("My Orders", "मेरे ऑर्डर")}
          </Link>
          <Link to="/products" className="flex-1 border-2 border-border py-3 rounded-xl font-bold text-sm hover:bg-muted transition text-center">
            {t("Continue Shopping", "खरीदारी जारी रखें")}
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
};

export default OrderSuccessPage;
