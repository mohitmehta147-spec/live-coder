import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Search, Package, Truck, CheckCircle, Clock, XCircle, MapPin, ChevronDown } from "lucide-react";

const statusSteps = [
  { key: "pending", label: "Order Placed", labelHi: "ऑर्डर प्लेस हुआ", icon: Clock },
  { key: "confirmed", label: "Confirmed", labelHi: "कन्फर्म", icon: Package },
  { key: "shipped", label: "Shipped", labelHi: "शिप हो गया", icon: Truck },
  { key: "delivered", label: "Delivered", labelHi: "डिलीवर हो गया", icon: CheckCircle },
];

const OrderTrackingPage = () => {
  const { t } = useLanguage();
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<any>(null);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [loadingUserOrders, setLoadingUserOrders] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchUserOrders(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (session?.user) fetchUserOrders(session.user.id);
    });
    // Auto-track from ?id= query param
    const params = new URLSearchParams(window.location.search);
    const qid = params.get("id");
    if (qid) {
      (async () => {
        const { data } = await supabase.from("orders").select("*")
          .or(`order_number.ilike.%${qid}%,id.ilike.${qid}%`)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data) {
          setOrder(data);
          const { data: itemsData } = await supabase.from("order_items").select("*").eq("order_id", data.id);
          setItems(itemsData || []);
        }
      })();
    }
    return () => subscription.unsubscribe();
  }, []);

  const fetchUserOrders = async (userId: string) => {
    setLoadingUserOrders(true);
    const { data } = await supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    setUserOrders(data || []);
    setLoadingUserOrders(false);
  };

  const trackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOrder(null);

    let query = supabase.from("orders").select("*");
    if (orderId.trim()) {
      const oid = orderId.trim();
      // Match by order_number (e.g. 08/05/26/VUS3 or WC-1234) OR by id prefix
      query = query.or(`order_number.ilike.%${oid}%,id.ilike.${oid}%`);
    }
    if (phone.trim()) query = query.eq("customer_phone", phone.trim());

    const { data, error: err } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (err || !data) {
      setError(t("Order not found. Please check your Order ID or Phone number.", "ऑर्डर नहीं मिला। कृपया अपना ऑर्डर ID या फ़ोन नंबर जांचें।"));
      setLoading(false);
      return;
    }

    setOrder(data);
    const { data: itemsData } = await supabase.from("order_items").select("*").eq("order_id", data.id);
    setItems(itemsData || []);
    setLoading(false);
  };

  const viewOrder = async (o: any) => {
    setOrder(o);
    const { data: itemsData } = await supabase.from("order_items").select("*").eq("order_id", o.id);
    setItems(itemsData || []);
  };

  const getStepIndex = (status: string) => {
    if (status === "cancelled") return -1;
    return statusSteps.findIndex(s => s.key === status);
  };

  const currentStep = order ? getStepIndex(order.status) : -1;

  usePageMeta("Track Your Order - VedicUpchar", "Track your VedicUpchar order status in real-time.");

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <SiteHeader />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-center mb-6">{t("Track Your Order", "अपना ऑर्डर ट्रैक करें")}</h1>

        <form onSubmit={trackOrder} className="bg-card rounded-xl border border-border p-5 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder={t("Order ID (first 8 chars)", "ऑर्डर ID (पहले 8 अक्षर)")} value={orderId} onChange={e => setOrderId(e.target.value)}
              className="px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
            <input placeholder={t("Phone Number", "फ़ोन नंबर")} value={phone} onChange={e => setPhone(e.target.value)} type="tel"
              className="px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
          </div>
          <button type="submit" disabled={loading || (!orderId.trim() && !phone.trim())}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
            <Search className="h-4 w-4" />
            {loading ? t("Searching...", "खोज रहे हैं...") : t("Track Order", "ऑर्डर ट्रैक करें")}
          </button>
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
        </form>

        {/* Logged-in user's orders */}
        {session && userOrders.length > 0 && !order && (
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-3">{t("Your Recent Orders", "आपके हाल के ऑर्डर")}</h2>
            <div className="space-y-2">
              {userOrders.map(o => {
                const step = getStepIndex(o.status);
                const statusLabel = o.status === "cancelled" 
                  ? t("Cancelled", "रद्द") 
                  : statusSteps[step]
                    ? t(statusSteps[step].label, statusSteps[step].labelHi) 
                    : o.status;
                return (
                  <button key={o.id} onClick={() => viewOrder(o)}
                    className="w-full text-left bg-card rounded-xl border border-border p-4 hover:shadow-md transition">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-mono font-bold text-sm">{o.order_number || `#${o.id.slice(0, 8)}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">₹{o.total}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          o.status === "delivered" ? "bg-green-100 text-green-800" :
                          o.status === "cancelled" ? "bg-red-100 text-red-800" :
                          o.status === "shipped" ? "bg-purple-100 text-purple-800" :
                          "bg-yellow-100 text-yellow-800"
                        }`}>{statusLabel}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {order && (
          <div className="space-y-5">
            {session && userOrders.length > 0 && (
              <button onClick={() => setOrder(null)} className="text-sm text-primary hover:underline">
                ← {t("Back to all orders", "सभी ऑर्डर पर वापस")}
              </button>
            )}
            
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Order ID</p>
                  <p className="font-mono font-bold text-sm">{order.order_number || order.id.slice(0, 8)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{t("Date", "तारीख")}</p>
                  <p className="font-medium text-sm">{new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>

              {order.status === "cancelled" ? (
                <div className="flex items-center gap-3 bg-destructive/10 rounded-xl p-4">
                  <XCircle className="h-6 w-6 text-destructive" />
                  <div>
                    <p className="font-bold text-destructive">{t("Order Cancelled", "ऑर्डर रद्द")}</p>
                    <p className="text-xs text-muted-foreground">{t("This order has been cancelled", "यह ऑर्डर रद्द कर दिया गया है")}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between relative mt-2">
                  <div className="absolute top-5 left-8 right-8 h-1 bg-border rounded-full z-0">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" 
                      style={{ width: `${Math.max(0, (currentStep / (statusSteps.length - 1)) * 100)}%` }} />
                  </div>
                  {statusSteps.map((step, i) => {
                    const Icon = step.icon;
                    const done = i <= currentStep;
                    return (
                      <div key={step.key} className="flex flex-col items-center z-10 relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} transition-colors`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <p className={`text-xs mt-2 text-center font-medium ${done ? 'text-primary' : 'text-muted-foreground'}`}>
                          {t(step.label, step.labelHi)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {(order as any).tracking_url && (
                <a href={(order as any).tracking_url} target="_blank" rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  <Truck className="h-4 w-4" /> {t("Track with courier", "कूरियर से ट्रैक करें")}
                </a>
              )}
              {(order as any).estimated_delivery && (
                <p className="text-sm text-muted-foreground mt-2">
                  {t("Estimated Delivery:", "अनुमानित डिलीवरी:")} <span className="font-medium text-foreground">{(order as any).estimated_delivery}</span>
                </p>
              )}
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-2"><MapPin className="h-4 w-4 text-primary" /> {t("Delivery Address", "डिलीवरी पता")}</h3>
              <p className="text-sm text-muted-foreground">{order.customer_name}</p>
              <p className="text-sm text-muted-foreground">{order.address}</p>
              {(order.city || order.pincode) && <p className="text-sm text-muted-foreground">{[order.city, order.pincode].filter(Boolean).join(", ")}</p>}
              <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold mb-3">{t("Order Items", "ऑर्डर आइटम")}</h3>
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ₹{item['price']}</p>
                    </div>
                    <p className="font-bold text-sm text-primary">₹{item['price'] * item.quantity}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold mt-3 pt-3 border-t border-border">
                <span>{t("Total", "कुल")}</span>
                <span className="text-primary">₹{order.total}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
};

export default OrderTrackingPage;
