import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate, Link } from "@tanstack/react-router";
import { useToast } from "@/hooks/use-toast";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { ShoppingBag, ChevronRight, Truck, Shield, CreditCard, LogIn, Tag, X, Wallet, MapPin, Plus, Minus, CheckCircle2, Sparkles, Trash2, PartyPopper } from "lucide-react";
import { notifyAdmin } from "@/lib/notify-admin";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const CheckoutPage = () => {
  const { items, totalPrice, clearCart, updateQuantity } = useCart();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "", city: "", state: "", pincode: "", notes: "",
  });
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "razorpay">("cod");
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [shippingCharge, setShippingCharge] = useState(0);
  const [shippingThreshold, setShippingThreshold] = useState(0);
  const [codMaxAmount, setCodMaxAmount] = useState(0);
  const [codMinAmount, setCodMinAmount] = useState(0);
  const [codEnabled, setCodEnabled] = useState(true);
  const [prepaidDiscount, setPrepaidDiscount] = useState(0);
  const [qtyTiers, setQtyTiers] = useState<{ min: number; percent: number }[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string>("");
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [couponCelebration, setCouponCelebration] = useState<{ code: string; amount: number } | null>(null);
  const totalMrpAmount = useMemo(() => items.reduce((sum, item) => sum + (item['mrp'] || item['price']) * item.quantity, 0), [items]);
  const productDiscount = Math.max(0, totalMrpAmount - totalPrice);
  const isFreeDelivery = shippingThreshold > 0 && totalPrice >= shippingThreshold;
  const baseShipping = isFreeDelivery ? 0 : shippingCharge;
  // Delhi Same-Day Delivery: +₹99 surcharge, only valid for orders placed before 5 PM
  const isDelhi = /delhi/i.test(form.state || "") || /delhi/i.test(form.city || "");
  const nowHour = new Date().getHours();
  const sameDayEligible = isDelhi && nowHour < 17;
  const [sameDayDelivery, setSameDayDelivery] = useState(false);
  useEffect(() => { if (!sameDayEligible) setSameDayDelivery(false); }, [sameDayEligible]);
  const sameDayCharge = sameDayDelivery ? 99 : 0;
  const appliedShipping = baseShipping + sameDayCharge;
  const appliedPrepaid = paymentMethod === "razorpay" && prepaidDiscount > 0 ? prepaidDiscount : 0;
  const matchedTier = useMemo(() => {
    if (!qtyTiers.length) return null;
    return [...qtyTiers].filter(t => totalPrice >= t.min).sort((a, b) => b.percent - a.percent)[0] || null;
  }, [qtyTiers, totalPrice]);
  const tierDiscount = matchedTier ? Math.round(totalPrice * matchedTier.percent / 100) : 0;
  const nextTier = useMemo(() => {
    if (!qtyTiers.length) return null;
    return [...qtyTiers].filter(t => totalPrice < t.min).sort((a, b) => a.min - b.min)[0] || null;
  }, [qtyTiers, totalPrice]);
  const finalTotal = Math.max(0, totalPrice - discount - appliedPrepaid - tierDiscount + appliedShipping);
  const totalSavings = productDiscount + discount + appliedPrepaid + tierDiscount + (isFreeDelivery ? shippingCharge : 0);

  // COD availability (on/off toggle + min/max thresholds from admin settings)
  const codAboveMax = codMaxAmount > 0 && finalTotal > codMaxAmount;
  const codBelowMin = codMinAmount > 0 && finalTotal < codMinAmount;
  const codUnavailable = !codEnabled || codAboveMax || codBelowMin;

  // If COD is not allowed for this order (or is not shown at all), never let the
  // selection stay on "cod" — otherwise an online-only order gets saved as COD.
  useEffect(() => {
    if (codUnavailable && paymentMethod === "cod" && razorpayEnabled) setPaymentMethod("razorpay");
  }, [codUnavailable, paymentMethod, razorpayEnabled]);



  useEffect(() => {
    supabase.from("coupons").select("*").eq("is_active", true).order("created_at", { ascending: false }).then(({ data }) => {
      const now = Date.now();
      const valid = (data || []).filter((c: any) => {
        if (c.valid_until && new Date(c.valid_until).getTime() < now) return false;
        if (c.max_uses && (c.used_count || 0) >= c.max_uses) return false;
        return true;
      });
      setAvailableCoupons(valid);
    });
  }, []);

  // Check if Razorpay is enabled from admin settings
  useEffect(() => {
    supabase.from("site_settings").select("key, value").in("key", ["razorpay_enabled", "shipping_charge", "shipping_threshold", "cod_max_amount", "cod_min_amount", "cod_enabled", "prepaid_discount", "qty_discount_tiers"]).then(({ data }) => {
      const enabled = data?.find(s => s.key === "razorpay_enabled")?.value === "true";
      setRazorpayEnabled(enabled);
      if (enabled) setPaymentMethod("razorpay");
      const codOn = data?.find(s => s.key === "cod_enabled")?.value !== "false";
      setCodEnabled(codOn);
      if (!codOn && enabled) setPaymentMethod("razorpay");
      const sc = Number(data?.find(s => s.key === "shipping_charge")?.value) || 0;
      const st = Number(data?.find(s => s.key === "shipping_threshold")?.value) || 0;
      const cm = Number(data?.find(s => s.key === "cod_max_amount")?.value) || 0;
      const cmin = Number(data?.find(s => s.key === "cod_min_amount")?.value) || 0;
      const pd = Number(data?.find(s => s.key === "prepaid_discount")?.value) || 0;
      const tiersRaw = data?.find(s => s.key === "qty_discount_tiers")?.value;
      let tiers: { min: number; percent: number }[] = [];
      try { if (tiersRaw) tiers = JSON.parse(tiersRaw); } catch {}
      setShippingCharge(sc);
      setShippingThreshold(st);
      setCodMaxAmount(cm);
      setCodMinAmount(cmin);
      setPrepaidDiscount(pd);
      setQtyTiers(Array.isArray(tiers) ? tiers.filter(t => t && typeof t.min === "number" && typeof t.percent === "number") : []);
    });
  }, []);

  // Load Razorpay script when enabled
  useEffect(() => {
    if (!razorpayEnabled) return;
    if (document.getElementById("razorpay-sdk")) return;
    const script = document.createElement("script");
    script.id = "razorpay-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, [razorpayEnabled]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setCheckingAuth(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingAuth(false);
      if (session?.user) {
        const rawEmail = session.user.email || "";
        const contactEmail = session.user.user_metadata?.['contact_email'] || "";
        // Don't show the internal @phone.local fake email — only show real one
        const displayEmail = contactEmail || (rawEmail.endsWith("@phone.local") ? "" : rawEmail);
        // Resolve phone from auth (OTP login stores on user['phone']) or metadata
        const rawPhone =
          session.user['phone'] ||
          session.user.user_metadata?.['phone'] ||
          session.user.user_metadata?.['mobile'] ||
          (rawEmail.endsWith("@phone.local") ? rawEmail.split("@")[0] : "") ||
          "";
        const phoneDigits = String(rawPhone).replace(/\D/g, "").slice(-10);
        setForm(f => ({
          ...f,
          email: displayEmail,
          name: session.user.user_metadata?.['full_name'] || "",
          phone: phoneDigits || String(rawPhone) || "",
        }));
        // Re-sync with the profile row so name/email/phone are never blank
        (supabase.auth as any).refreshUser?.().then((u: any) => {
          if (!u) return;
          setForm(f => ({
            ...f,
            name: f.name || u.user_metadata?.['full_name'] || "",
            email: f.email || u.email || "",
            phone: f['phone'] || u['phone'] || "",
          }));
        }).catch(() => {});
        // Load saved addresses
        (supabase as any).from("user_addresses").select("*").eq("user_id", session.user.id)
          .order("is_default", { ascending: false })
          .then(({ data }: any) => {
            setSavedAddresses(data || []);
            const def = (data || []).find((a: any) => a.is_default) || (data || [])[0];
            if (def) {
              setSelectedAddrId(def.id);
              setForm(f => ({
                ...f,
                name: def['full_name'] || f.name,
                phone: def['phone'] || f['phone'],
                address: def.address || f.address,
                city: def.city || f.city,
                state: def.state || f.state,
                pincode: def.pincode || f.pincode,
              }));
            }
          });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const selectAddress = (a: any) => {
    setSelectedAddrId(a.id);
    setForm(f => ({
      ...f,
      name: a['full_name'] || "",
      phone: a['phone'] || "",
      address: a.address || "",
      city: a.city || "",
      state: a.state || "",
      pincode: a.pincode || "",
    }));
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar /><SiteHeader />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading...</div>
        <SiteFooter />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar /><SiteHeader />
        <div className="container mx-auto px-4 py-20 text-center">
          <LogIn className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{t("Please login to place an order", "ऑर्डर करने के लिए कृपया लॉगिन करें")}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t("You need to sign in before checkout", "चेकआउट से पहले साइन इन करना ज़रूरी है")}</p>
          <Link to="/auth" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition">
            <LogIn className="h-4 w-4" /> {t("Login / Sign Up", "लॉगिन / साइन अप")}
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar /><SiteHeader />
        <div className="container mx-auto px-4 py-20 text-center">
          <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{t("Your cart is empty", "आपका कार्ट खाली है")}</h2>
          <Link to="/products" className="text-primary hover:underline">{t("Browse Products", "उत्पाद देखें")}</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const applyCoupon = async (overrideCode?: string) => {
    const normalizedCoupon = (overrideCode || couponCode).toUpperCase().trim();
    if (!normalizedCoupon) return;
    setCouponLoading(true);
    const { data, error } = await supabase.from("coupons").select("*").eq("code", normalizedCoupon).eq("is_active", true).single();
    setCouponLoading(false);
    if (error || !data) { toast({ title: t("Invalid coupon code", "अमान्य कूपन कोड"), variant: "destructive" }); return; }
    if (data.min_order_value && totalPrice < data.min_order_value) { toast({ title: t(`Min order ₹${data.min_order_value} required`, `न्यूनतम ऑर्डर ₹${data.min_order_value} आवश्यक`), variant: "destructive" }); return; }
    if (data.max_uses && data.used_count >= data.max_uses) { toast({ title: t("Coupon usage limit reached", "कूपन सीमा पूरी"), variant: "destructive" }); return; }
    const disc = data.discount_type === "percentage" ? Math.round(totalPrice * data.discount_value / 100) : data.discount_value;
    setCouponCode(normalizedCoupon);
    setAppliedCoupon(data); setDiscount(disc); setCouponCelebration({ code: data.code, amount: disc });
    window.setTimeout(() => setCouponCelebration(null), 5000);
  };

  const removeCoupon = () => { setAppliedCoupon(null); setDiscount(0); setCouponCode(""); };

  const sanitize = (str: string) => str.replace(/[<>]/g, '').trim();

  const createOrderInDB = async () => {
    const cleanName = sanitize(form.name);
    const cleanPhone = form['phone'].replace(/[^\d\+\-\s]/g, '').trim();
    const cleanAddress = sanitize(form.address);

    const totalDiscountForOrder = discount + appliedPrepaid + tierDiscount;
    // Snapshot of cart items, also stored on orders.items as a safety net so admin
    // can always render line items even if the order_items insert fails for any reason.
    const lineName = (item: typeof items[number]) =>
      item.variant_label ? `${item.name} (${item.variant_label})` : item.name;
    const itemsSnapshot = items.map(item => ({
      product_id: item.product_id || item.id, product_name: lineName(item), name: lineName(item),
      variant: item.variant_label || null,
      quantity: item.quantity, price: item['price'],
    }));
    const { data: order, error } = await supabase.from("orders").insert([{
      customer_name: cleanName, customer_phone: cleanPhone, customer_email: sanitize(form.email),
      address: cleanAddress, city: sanitize(form.city) || null, state: sanitize(form.state) || null, pincode: form.pincode.replace(/\D/g, '').slice(0, 6) || null,
      notes: sanitize(form.notes) || null, total: finalTotal, subtotal: totalPrice, discount: totalDiscountForOrder, shipping: appliedShipping,
      user_id: session.user.id, status: "pending",
      payment_status: paymentMethod === "cod" ? "cod" : "pending",
      payment_method: paymentMethod,
      items: itemsSnapshot as any,
    }]).select("id, order_number").single();

    if (error || !order) throw new Error(error?.message || "Order creation failed");

    if (appliedCoupon) {
      await supabase.from("coupons").update({ used_count: (appliedCoupon.used_count || 0) + 1 }).eq("id", appliedCoupon.id);
    }

    const orderItems = items.map(item => ({
      order_id: order.id, product_id: item.product_id || item.id, product_name: lineName(item),
      quantity: item.quantity, price: item['price'],
    }));
    const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
    if (itemsErr) {
      console.error("order_items insert failed (snapshot saved on orders.items):", itemsErr);
    }

    notifyAdmin({
      formType: "🛒 New Order Booking",
      subjectLine: `🛒 New Order ${order.order_number || order.id.slice(0, 8)} — ₹${finalTotal}`,
      idempotencyKey: `order-${order.id}`,
      fields: {
        order_number: order.order_number || order.id,
        customer_name: cleanName, phone: cleanPhone, email: form.email,
        address: cleanAddress, city: form.city, state: form.state, pincode: form.pincode,
        items: items.map(i => `${i.name} x${i.quantity} (₹${i['price']})`).join("\n"),
        subtotal: `₹${totalPrice}`, discount: `₹${totalDiscountForOrder}`, shipping: `₹${appliedShipping}`, total: `₹${finalTotal}`,
        payment_method: paymentMethod, coupon: appliedCoupon?.code,
      },
    });

    return order;
  };

  const sendOrderEmail = async (orderId: string) => {
    try {
      await supabase.functions.invoke("send-order-email", {
        body: {
          orderId, customerEmail: form.email, customerName: form.name, customerPhone: form['phone'],
          items: items.map(item => ({ order_id: orderId, product_id: item.id, product_name: item.name, quantity: item.quantity, price: item['price'] })),
          subtotal: totalPrice, discount, total: finalTotal,
          address: form.address, city: form.city || "", pincode: form.pincode || "",
          couponCode: appliedCoupon?.code || "",
        },
      });
    } catch (emailErr) {
      console.error("Email send failed:", emailErr);
    }
  };

  const handleRazorpayPayment = async (orderId: string) => {
    // Create Razorpay order via edge function
    const { data: rzpData, error: rzpError } = await supabase.functions.invoke("create-razorpay-order", {
      body: { amount: finalTotal, receipt: orderId },
    });

    if (rzpError || !rzpData?.order_id) {
      toast({ title: t("Payment initialization failed", "भुगतान शुरू नहीं हो सका"), description: rzpError?.message || rzpData?.error, variant: "destructive" });
      // Fallback: delete the pending order
      await supabase.from("orders").update({ status: "cancelled", payment_status: "failed" }).eq("id", orderId);
      return false;
    }

    return new Promise<boolean>((resolve) => {
      const options = {
        key: rzpData.key_id,
        amount: rzpData.amount,
        currency: rzpData.currency,
        name: t("VedicUpchar", "वैदिक उपचार"),
        description: t("Order Payment", "ऑर्डर भुगतान"),
        order_id: rzpData.order_id,
        prefill: {
          name: form.name,
          email: form.email,
          contact: form['phone'],
        },
        theme: { color: "#16a34a" },
        handler: async (response: any) => {
          // Verify payment on server
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-razorpay-payment", {
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              order_id: orderId,
            },
          });

          if (verifyError || !verifyData?.verified) {
            toast({ title: t("Payment verification failed", "भुगतान सत्यापन विफल"), variant: "destructive" });
            resolve(false);
          } else {
            resolve(true);
          }
        },
        modal: {
          ondismiss: async () => {
            await supabase.from("orders").update({ payment_status: "failed", status: "cancelled" }).eq("id", orderId);
            toast({ title: t("Payment cancelled", "भुगतान रद्द") });
            resolve(false);
          },
        },
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        toast({ title: t("Payment gateway loading failed. Please refresh.", "पेमेंट गेटवे लोड नहीं हुआ। कृपया रीफ्रेश करें।"), variant: "destructive" });
        resolve(false);
      }
    });
  };

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitize(form.name);
    const cleanPhone = form['phone'].replace(/[^\d\+\-\s]/g, '').trim();
    const cleanAddress = sanitize(form.address);

    if (!cleanName || cleanName.length > 100) {
      toast({ title: t("Invalid name", "अमान्य नाम"), variant: "destructive" }); return;
    }
    if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 15) {
      toast({ title: t("Invalid phone number", "अमान्य फोन नंबर"), variant: "destructive" }); return;
    }
    if (!cleanAddress || cleanAddress.length > 500) {
      toast({ title: t("Invalid address", "अमान्य पता"), variant: "destructive" }); return;
    }
    // Safety net: COD not allowed for this order amount → force online payment
    if (paymentMethod === "cod" && codUnavailable) {
      if (razorpayEnabled) {
        setPaymentMethod("razorpay");
        toast({ title: t("COD not available for this order — please pay online", "इस ऑर्डर के लिए COD उपलब्ध नहीं — कृपया ऑनलाइन भुगतान करें") });
      } else {
        toast({ title: t("COD not available for this order amount", "इस ऑर्डर राशि के लिए COD उपलब्ध नहीं"), variant: "destructive" });
      }
      return;
    }

    setLoading(true);


    try {
      const order = await createOrderInDB();

      if (paymentMethod === "razorpay") {
        const paymentSuccess = await handleRazorpayPayment(order.id);
        if (!paymentSuccess) {
          setLoading(false);
          return;
        }
      }

      await sendOrderEmail(order.id);
      // Send SMS notification
      try {
        await supabase.functions.invoke("send-order-sms", {
          body: {
            orderId: order.id,
            customerName: form.name,
            customerPhone: form['phone'],
            orderNumber: order.order_number,
            total: finalTotal,
          },
        });
      } catch (smsErr) {
        console.error("Order SMS failed:", smsErr);
      }
      clearCart();
      setLoading(false);
      navigate({ to: "/order-success", search: { id: String(order.id) } });
    } catch (err: any) {
      toast({ title: t("Order failed", "ऑर्डर विफल"), description: err?.message, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar /><SiteHeader />
      <div className="bg-muted/50 border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">{t("Home", "होम")}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{t("Checkout", "चेकआउट")}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-10">
        <h1 className="text-2xl font-bold mb-6">{t("Checkout", "चेकआउट")}</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleOrder} className="space-y-4 lg:col-span-2">
            {savedAddresses.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-primary" />{t("Saved Addresses", "सहेजे गए पते")}</h3>
                  <Link to="/my-addresses" className="text-xs text-primary font-semibold hover:underline">{t("Manage", "प्रबंधित करें")}</Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {savedAddresses.map(a => (
                    <button key={a.id} type="button" onClick={() => selectAddress(a)}
                      className={`text-left p-3 rounded-xl border-2 transition ${selectedAddrId === a.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase bg-muted px-2 py-0.5 rounded">{a.label || "Address"}</span>
                        {a.is_default && <span className="text-[9px] text-green-700 font-semibold">DEFAULT</span>}
                      </div>
                      <p className="text-xs font-semibold">{a['full_name']} · {a['phone']}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{a.address}, {a.city} {a.pincode}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> {t("Delivery Details", "डिलीवरी विवरण")}</h3>
                {session && <Link to="/my-addresses" className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1"><Plus className="h-3 w-3" />{t("Save", "सहेजें")}</Link>}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input required placeholder={t("Full Name *", "पूरा नाम *")} value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoComplete="name" name="name" className="px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
                <input required placeholder={t("Phone *", "फोन *")} value={form['phone']} onChange={e => setForm({...form, phone: e.target.value})} type="tel" autoComplete="tel" name="phone" className="px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
                <input placeholder={t("Email", "ईमेल")} value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" autoComplete="email" name="email" className="px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
                <input placeholder={t("Pincode (auto-fills City & State)", "पिनकोड (शहर/राज्य ऑटो)")} value={form.pincode} onChange={async (e) => {
                  const pin = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setForm(f => ({...f, pincode: pin}));
                  if (pin.length === 6) {
                    try {
                      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
                      const data = await res.json();
                      if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
                        const po = data[0].PostOffice[0];
                        setForm(f => ({...f, pincode: pin, city: po.District, state: po.State}));
                      }
                    } catch {}
                  }
                }} inputMode="numeric" maxLength={6} autoComplete="postal-code" name="pincode" className="px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
                <input placeholder={t("City", "शहर")} value={form.city} onChange={e => setForm({...form, city: e.target.value})} autoComplete="address-level2" name="city" className="px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
                <input placeholder={t("State", "राज्य")} value={form.state} onChange={e => setForm({...form, state: e.target.value})} autoComplete="address-level1" name="state" className="px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
              </div>
              <textarea required placeholder={t("Full Address *", "पूरा पता *")} value={form.address} onChange={e => setForm({...form, address: e.target.value})} rows={2} autoComplete="street-address" name="address" className="w-full px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
              <textarea placeholder={t("Order Notes (optional)", "ऑर्डर नोट्स (वैकल्पिक)")} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} name="notes" className="w-full px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none" />
            </div>
            {/* Coupon Section */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /> {t("Apply Coupon", "कूपन लगाएं")}</h3>
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-xl p-3">
                  <div>
                    <span className="font-mono font-bold text-primary">{appliedCoupon.code}</span>
                    <span className="text-sm text-muted-foreground ml-2">-₹{discount} {t("discount", "छूट")}</span>
                  </div>
                  <button type="button" onClick={removeCoupon} className="p-1 hover:bg-destructive/10 rounded"><X className="h-4 w-4 text-destructive" /></button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input placeholder={t("Enter coupon code", "कूपन कोड दर्ज करें")} value={couponCode} onChange={e => setCouponCode(e.target.value)} className="flex-1 px-4 py-3 border-2 border-border rounded-xl text-sm bg-background focus:border-primary focus:outline-none uppercase" />
                    <button type="button" onClick={() => void applyCoupon()} disabled={couponLoading} className="bg-primary text-primary-foreground px-5 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 sm:min-w-28">
                      {couponLoading ? "..." : t("Apply", "लागू करें")}
                    </button>
                  </div>
                  {availableCoupons.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs text-muted-foreground font-medium">{t("Available Coupons", "उपलब्ध कूपन")}:</p>
                      <div className="space-y-1.5">
                        {availableCoupons.map(c => (
                          <button key={c.id} type="button"
                            onClick={() => void applyCoupon(c.code)}
                            className="w-full flex items-center justify-between gap-2 border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 rounded-lg px-3 py-2 transition text-left">
                            <div className="min-w-0">
                              <span className="font-mono font-bold text-primary text-sm">{c.code}</span>
                              <p className="text-[11px] text-muted-foreground">
                                {c.discount_type === "percentage" ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}
                                {c.min_order_value > 0 ? ` • Min ₹${c.min_order_value}` : ""}
                                {c.valid_until ? ` • till ${new Date(c.valid_until).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : ""}
                              </p>
                            </div>
                            <span className="text-[10px] text-primary font-semibold uppercase tracking-wide shrink-0">{t("Tap to apply", "लगाएं")}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Payment Method */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> {t("Payment Method", "भुगतान विधि")}</h3>
              
              {razorpayEnabled && (
                <button type="button" onClick={() => setPaymentMethod("razorpay")}
                  className={`w-full flex items-center gap-3 border-2 rounded-xl p-3 transition ${paymentMethod === "razorpay" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                  <div className={`w-4 h-4 rounded-full border-4 ${paymentMethod === "razorpay" ? "border-primary" : "border-muted-foreground/30"}`} />
                  <Wallet className="h-4 w-4 text-primary" />
                  <div className="text-left">
                    <span className="font-medium text-sm">{t("Pay Online", "ऑनलाइन भुगतान")}</span>
                    <p className="text-xs text-muted-foreground">{t("UPI, Cards, Net Banking, Wallets", "UPI, कार्ड, नेट बैंकिंग, वॉलेट")}</p>
                  </div>
                </button>
              )}

              {(() => {
                const codBlocked = codUnavailable;
                // Hide COD entirely if admin turned it off, or order is below the minimum threshold
                if (!codEnabled || codBelowMin) return null;
                return (
                  <button type="button" onClick={() => !codBlocked && setPaymentMethod("cod")} disabled={codBlocked}

                    className={`w-full flex items-center gap-3 border-2 rounded-xl p-3 transition ${paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"} ${codBlocked ? "opacity-50 cursor-not-allowed" : ""}`}>
                    <div className={`w-4 h-4 rounded-full border-4 ${paymentMethod === "cod" ? "border-primary" : "border-muted-foreground/30"}`} />
                    <Truck className="h-4 w-4 text-primary" />
                    <div className="text-left">
                      <span className="font-medium text-sm">{t("Cash on Delivery (COD)", "कैश ऑन डिलीवरी (COD)")}</span>
                      <p className="text-xs text-muted-foreground">
                        {codAboveMax
                          ? t(`COD not available for orders above ₹${codMaxAmount}`, `₹${codMaxAmount} से ऊपर के ऑर्डर के लिए COD उपलब्ध नहीं`)
                          : t("Pay when you receive", "मिलने पर भुगतान करें")}
                      </p>
                    </div>
                  </button>
                );
              })()}
            </div>

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-cta py-4 text-base font-bold text-cta-foreground transition hover:opacity-90 disabled:opacity-60">
              {loading
                ? t("Processing...", "प्रोसेस हो रहा है...")
                : paymentMethod === "razorpay"
                  ? t(`Pay Online — ₹${finalTotal}`, `ऑनलाइन भुगतान — ₹${finalTotal}`)
                  : t(`Place Order (COD) — ₹${finalTotal}`, `ऑर्डर प्लेस करें (COD) — ₹${finalTotal}`)}
            </button>
          </form>

          <div className="h-fit rounded-xl border border-border bg-card p-4 sm:p-5 lg:sticky lg:top-20">
            <h3 className="font-semibold mb-4">{t("Order Summary", "ऑर्डर सारांश")} ({items.length})</h3>
            <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-1">
              {items.map(item => (
                <div key={item.id} className="flex gap-3 rounded-xl border border-border/60 p-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.image_url ? <img loading="lazy" decoding="async" src={item.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">🌿</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{lang === "hi" && item.name_hi ? item.name_hi : item.name}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-1 py-0.5 shadow-sm">
                        <button
                          type="button"
                          aria-label={item.quantity <= 1 ? `Remove ${item.name}` : `Decrease ${item.name}`}
                          onClick={() => item.quantity <= 1 ? updateQuantity(item.id, 0) : updateQuantity(item.id, item.quantity - 1)}
                          className={`flex h-7 w-7 items-center justify-center rounded-full transition active:scale-90 ${item.quantity <= 1 ? "text-destructive hover:bg-destructive/10" : "text-primary hover:bg-primary/10"}`}
                        >
                          {item.quantity <= 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                        </button>
                        <span className="min-w-6 text-center text-sm font-bold text-foreground">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${item.name}`}
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-primary transition hover:bg-primary/10 active:scale-90"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">₹{item['price'] * item.quantity}</p>
                        {(item['mrp'] || item['price']) > item['price'] && (
                          <p className="text-[11px] text-muted-foreground line-through">₹{(item['mrp'] || item['price']) * item.quantity}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span>{t("Total MRP", "कुल MRP")}</span><span>₹{totalMrpAmount}</span></div>

              {/* Shipping shown FIRST */}
              <div className="flex justify-between text-sm">
                <span>{t("Shipping Charges", "शिपिंग शुल्क")}</span>
                {isFreeDelivery || baseShipping === 0 ? (
                  <span className="text-green-600 font-medium">{t("FREE", "मुफ्त")} 🎉</span>
                ) : (
                  <span className="text-foreground">+ ₹{baseShipping}</span>
                )}
              </div>

              {sameDayEligible && (
                <div className="rounded-lg border-2 border-cta/40 bg-cta/5 p-2.5">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={sameDayDelivery} onChange={e => setSameDayDelivery(e.target.checked)} className="mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-foreground">⚡ {t("Same Day Delivery (Delhi only)", "उसी दिन डिलीवरी (केवल दिल्ली)")} + ₹99</p>
                      <p className="text-[10px] text-muted-foreground">{t("Order before 5:00 PM. Extra ₹99 delivery charges.", "5:00 बजे शाम से पहले ऑर्डर करें। ₹99 अतिरिक्त।")}</p>
                    </div>
                  </label>
                </div>
              )}
              {sameDayCharge > 0 && (
                <div className="flex justify-between text-sm">
                  <span>{t("Same Day Delivery", "उसी दिन डिलीवरी")}</span><span>+ ₹{sameDayCharge}</span>
                </div>
              )}

              {/* Discounts AFTER shipping */}
              {productDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600"><span>{t("Discount on MRP", "MRP पर छूट")}</span><span>− ₹{productDiscount}</span></div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600"><span>{t("Coupon Discount", "कूपन छूट")}</span><span>− ₹{discount}</span></div>
              )}
              {tierDiscount > 0 && matchedTier && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>{t(`Quantity Offer (${matchedTier.percent}% on ₹${matchedTier.min}+)`, `मात्रा छूट (${matchedTier.percent}% ₹${matchedTier.min}+ पर)`)}</span>
                  <span>− ₹{tierDiscount}</span>
                </div>
              )}
              {appliedPrepaid > 0 && (
                <div className="flex justify-between text-sm text-green-600"><span>{t("Prepaid Discount", "प्रीपेड छूट")}</span><span>− ₹{appliedPrepaid}</span></div>
              )}

              {!isFreeDelivery && shippingThreshold > 0 && totalPrice < shippingThreshold && (
                <p className="text-xs text-muted-foreground">
                  {t(`Add ₹${shippingThreshold - totalPrice} more for FREE delivery!`, `₹${shippingThreshold - totalPrice} और जोड़ें और डिलीवरी मुफ्त पाएं!`)}
                </p>
              )}
              {nextTier && (
                <p className="text-xs font-medium text-cta">
                  ✨ {t(`Add ₹${nextTier.min - totalPrice} more to get ${nextTier.percent}% OFF!`, `₹${nextTier.min - totalPrice} और जोड़ें और ${nextTier.percent}% छूट पाएं!`)}
                </p>
              )}
              {totalSavings > 0 && (
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 px-3 py-2 text-sm font-semibold text-green-700 dark:text-green-400 flex items-center justify-between">
                  <span>🧾 {t("Total Savings", "कुल बचत")}</span><span>₹{totalSavings}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t border-border pt-3 mt-1">
                <span>💳 {t("Final Payable Amount", "अंतिम भुगतान राशि")}</span>
                <span className="text-primary">₹{finalTotal}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" /> {t("100% Secure & Safe Payments", "100% सुरक्षित भुगतान")}
            </div>
          </div>
        </div>
      </div>
      {couponCelebration && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm animate-fade-in">
          {/* Full-screen confetti rain */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden z-[90]">
            {Array.from({ length: 70 }).map((_, i) => {
              const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899", "#eab308"];
              const left = Math.random() * 100;
              const delay = Math.random() * 1.5;
              const dur = 2.5 + Math.random() * 2;
              const bg = colors[i % colors.length];
              const w = 6 + Math.round(Math.random() * 8);
              const h = 10 + Math.round(Math.random() * 8);
              return (
                <span key={`c-${i}`} className="confetti-piece" style={{ left: `${left}%`, background: bg, animationDuration: `${dur}s`, animationDelay: `${delay}s`, width: `${w}px`, height: `${h}px` }} />
              );
            })}
            {/* Falling party popper icons */}
            {Array.from({ length: 14 }).map((_, i) => {
              const left = Math.random() * 100;
              const delay = Math.random() * 2;
              const dur = 3 + Math.random() * 2;
              const size = 22 + Math.round(Math.random() * 18);
              return (
                <span key={`p-${i}`} className="confetti-piece" style={{ left: `${left}%`, background: "transparent", animationDuration: `${dur}s`, animationDelay: `${delay}s`, width: `${size}px`, height: `${size}px`, fontSize: `${size}px`, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  🎉
                </span>
              );
            })}
          </div>
          <div className="relative z-[85] w-full max-w-sm overflow-hidden rounded-3xl border-2 border-primary/30 bg-card px-6 py-8 text-center shadow-2xl animate-scale-in">
            <button type="button" onClick={() => setCouponCelebration(null)} className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
            <div className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center text-7xl animate-bounce">
              <span className="absolute -left-6 -top-2 text-4xl rotate-[-20deg]">🎉</span>
              🎉
              <span className="absolute -right-6 -top-2 text-4xl rotate-[20deg]">🎉</span>
            </div>
            <h3 className="text-4xl font-extrabold text-foreground tracking-tight flex items-center justify-center gap-2">
              <span className="text-3xl">🎉</span> {t("Congrats!", "बधाई हो!")} <span className="text-3xl">🎉</span>
            </h3>
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-bold text-primary">{couponCelebration.code}</span> {t("applied successfully.", "सफलतापूर्वक लागू हुआ।")}
            </p>
            <p className="mt-2 text-2xl font-extrabold text-foreground">
              {t("You saved", "आपने बचाए")} <span className="text-cta">₹{couponCelebration.amount}</span> {t("with this coupon", "इस कूपन से")}
            </p>
            <button type="button" onClick={() => setCouponCelebration(null)} className="mt-6 inline-flex min-w-48 items-center justify-center rounded-xl bg-cta px-5 py-3 text-sm font-bold text-cta-foreground transition hover:scale-105 hover:shadow-lg">
              {t("Yay, Thanks!", "बहुत बढ़िया!")}
            </button>
          </div>
        </div>
      )}
      <SiteFooter />
    </div>
  );
};

export default CheckoutPage;
