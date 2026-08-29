import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";

const HIDE_ROUTES = ["/checkout", "/auth", "/admin", "/order-success", "/booking-success"];

const FreeDeliveryBar = () => {
  const { items, totalItems, totalPrice, setIsOpen } = useCart();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [threshold, setThreshold] = useState(499);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "shipping_threshold").maybeSingle()
      .then(({ data }) => { const v = parseFloat(data?.value || "499"); if (!isNaN(v) && v > 0) setThreshold(v); });
  }, []);

  if (totalItems === 0) return null;
  if (HIDE_ROUTES.some(r => location.pathname.startsWith(r))) return null;

  const remaining = Math.max(0, threshold - totalPrice);
  const progress = Math.min(100, (totalPrice / threshold) * 100);
  const firstItem = items[0];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)] md:hidden">
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-lg">🛵</div>
          <p className="flex-1 text-xs font-semibold text-foreground leading-tight">
            {remaining > 0
              ? t(`Shop for ₹${remaining} more to get free delivery`, `मुफ्त डिलीवरी के लिए ₹${remaining} और जोड़ें`)
              : t("🎉 You unlocked FREE delivery!", "🎉 आपको मुफ्त डिलीवरी मिल गई!")}
          </p>
          <button onClick={() => setExpanded(v => !v)} className="text-primary text-[11px] font-bold flex items-center gap-0.5 shrink-0">
            {t("OFFERS", "ऑफर")} {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden mb-2">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsOpen(true)} className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full border-2 border-border overflow-hidden bg-muted shrink-0">
              {firstItem?.image_url
                ? <img loading="lazy" decoding="async" src={firstItem.image_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-lg">🌿</div>}
            </div>
            <div className="text-left min-w-0">
              <p className="font-bold text-foreground text-sm leading-tight">₹{totalPrice.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{totalItems} {totalItems === 1 ? t("item", "आइटम") : t("items", "आइटम")}</p>
            </div>
          </button>
          <button onClick={() => navigate({ to: "/checkout" })}
            className="bg-cta text-cta-foreground px-6 py-2.5 rounded-full font-bold text-sm hover:opacity-90 transition shrink-0">
            {t("Proceed", "आगे बढ़ें")}
          </button>
        </div>
        {expanded && (
          <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
            {t(`Free delivery on orders above ₹${threshold}`, `₹${threshold} से अधिक के ऑर्डर पर मुफ्त डिलीवरी`)}
          </div>
        )}
      </div>
    </div>
  );
};

export default FreeDeliveryBar;
