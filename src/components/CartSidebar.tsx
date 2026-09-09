import { X, Plus, Minus, ShoppingBag, Trash2, LogIn } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const CartSidebar = () => {
  const { items, isOpen, setIsOpen, removeFromCart, updateQuantity, totalItems, totalPrice, clearCart } = useCart();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [tiers, setTiers] = useState<{ min: number; percent: number }[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    supabase.from("site_settings").select("value").eq("key", "qty_discount_tiers").maybeSingle().then(({ data }) => {
      try { const arr = data?.value ? JSON.parse(data.value) : []; if (Array.isArray(arr)) setTiers(arr); } catch {}
    });
    return () => subscription.unsubscribe();
  }, []);

  const matchedTier = tiers.length ? [...tiers].filter(t => totalPrice >= t.min).sort((a, b) => b.percent - a.percent)[0] : null;
  const nextTier = tiers.length ? [...tiers].filter(t => totalPrice < t.min).sort((a, b) => a.min - b.min)[0] : null;
  const tierSaving = matchedTier ? Math.round(totalPrice * matchedTier.percent / 100) : 0;

  if (!isOpen) return null;

  const handleCheckout = () => {
    if (!session) {
      setIsOpen(false);
      toast({ title: t("Please login first", "कृपया पहले लॉगिन करें"), description: t("You need to sign in before checkout", "चेकआउट से पहले साइन इन करना ज़रूरी है"), variant: "destructive" });
      navigate({ to: "/auth" });
      return;
    }
    setIsOpen(false);
    navigate({ to: "/checkout" });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setIsOpen(false)} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card z-[70] shadow-2xl flex flex-col animate-in slide-in-from-right">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-lg">{t("Your Cart", "आपका कार्ट")} ({totalItems})</h2>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-muted rounded-full transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">{t("Your cart is empty", "आपका कार्ट खाली है")}</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-3 bg-muted/50 rounded-xl p-3">
                <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden shrink-0">
                  {item.image_url ? (
                    <img loading="lazy" decoding="async" src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">🌿</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm line-clamp-2">{lang === "hi" && item.name_hi ? item.name_hi : item.name}</h3>
                  {item.variant_label && (
                    <p className="mt-0.5 text-[11px] font-semibold text-primary">{item.variant_label}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-bold text-primary">₹{item['price']}</span>
                    {item['mrp'] > item['price'] && <span className="text-xs text-muted-foreground line-through">₹{item['mrp']}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 overflow-hidden shadow-sm">
                      <button
                        onClick={() => item.quantity <= 1 ? removeFromCart(item.id) : updateQuantity(item.id, item.quantity - 1)}
                        aria-label={item.quantity <= 1 ? "Remove item" : "Decrease"}
                        className={`p-2 transition active:scale-90 ${item.quantity <= 1 ? "text-destructive hover:bg-destructive/10" : "text-primary hover:bg-primary/10"}`}
                      >
                        {item.quantity <= 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      </button>
                      <span className="px-2 min-w-[28px] text-center text-sm font-bold text-foreground">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="Increase" className="p-2 text-primary hover:bg-primary/10 transition active:scale-90"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <span className="text-sm font-bold text-primary">₹{(item['price'] * item.quantity).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border p-4 space-y-3">
            {matchedTier && tierSaving > 0 && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 px-3 py-2 text-xs font-semibold text-green-700 dark:text-green-400 flex items-center justify-between">
                <span>🎁 {t(`${matchedTier.percent}% OFF applied`, `${matchedTier.percent}% छूट लागू`)}</span><span>− ₹{tierSaving}</span>
              </div>
            )}
            {nextTier && (
              <p className="text-xs text-cta font-medium">✨ {t(`Add ₹${nextTier.min - totalPrice} more to unlock ${nextTier.percent}% OFF`, `₹${nextTier.min - totalPrice} और जोड़ें — ${nextTier.percent}% छूट पाएं`)}</p>
            )}
            <div className="flex justify-between items-center">
              <span className="font-medium">{t("Total", "कुल")}</span>
              <span className="text-xl font-bold text-primary">₹{totalPrice.toLocaleString()}</span>
            </div>
            {!session && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <LogIn className="h-3 w-3" /> {t("Login required for checkout", "चेकआउट के लिए लॉगिन ज़रूरी है")}
              </p>
            )}
            <button onClick={handleCheckout} className="w-full bg-cta text-cta-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition">
              {session ? t("Proceed to Checkout", "चेकआउट करें") : t("Login & Checkout", "लॉगिन और चेकआउट करें")}
            </button>
            <button onClick={clearCart} className="w-full text-center text-sm text-muted-foreground hover:text-destructive transition">
              {t("Clear Cart", "कार्ट खाली करें")}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default CartSidebar;
