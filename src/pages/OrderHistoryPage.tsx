import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, useNavigate } from "@tanstack/react-router";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Package, ChevronRight, Download, Eye, LogIn, Clock, CheckCircle, Truck, XCircle, ShoppingBag, Ban, Mail, Save, Star, Upload, X as XIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusConfig: Record<string, { icon: any; color: string; label: string; labelHi: string }> = {
  pending: { icon: Clock, color: "bg-yellow-100 text-yellow-800", label: "Pending", labelHi: "लंबित" },
  confirmed: { icon: Package, color: "bg-blue-100 text-blue-800", label: "Confirmed", labelHi: "कन्फर्म" },
  shipped: { icon: Truck, color: "bg-purple-100 text-purple-800", label: "Shipped", labelHi: "शिप" },
  delivered: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Delivered", labelHi: "डिलीवर" },
  cancelled: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Cancelled", labelHi: "रद्द" },
};

const OrderHistoryPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  usePageMeta("My Orders - VedicUpchar", "View your order history, track orders and download invoices.");
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [returnFor, setReturnFor] = useState<any | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  // Cancel modal state
  const [cancelFor, setCancelFor] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOther, setCancelOther] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const CANCEL_REASONS = [
    { en: "Found a better deal elsewhere", hi: "कहीं और बेहतर डील मिली" },
    { en: "Technical issues with the website", hi: "वेबसाइट में तकनीकी समस्या" },
    { en: "I changed my mind", hi: "मैंने मन बदल दिया" },
    { en: "Have issues with coupons", hi: "कूपन में समस्या" },
    { en: "Others", hi: "अन्य" },
  ];

  const RETURN_REASONS = [
    { en: "Damaged or broken on arrival", hi: "पहुंचने पर क्षतिग्रस्त या टूटा हुआ" },
    { en: "Wrong product received", hi: "गलत प्रोडक्ट मिला" },
    { en: "Product expired or near expiry", hi: "प्रोडक्ट एक्सपायर या एक्सपायरी के पास" },
    { en: "Quality not as expected", hi: "गुणवत्ता अपेक्षा के अनुरूप नहीं" },
    { en: "Missing items in package", hi: "पैकेज में कुछ चीजें गायब" },
  ];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchOrders(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (session?.user) fetchOrders(session.user.id);
      else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchOrders = async (userId: string) => {
    setLoading(true);
    // Get user's phone/email from auth metadata AND the profile row (older accounts only have it on the profile)
    const { data: userData } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("phone,email").eq("user_id", userId).maybeSingle();
    const rawPhone =
      (profile as any)?.['phone'] ||
      userData?.user?.['phone'] ||
      userData?.user?.user_metadata?.['phone'] ||
      userData?.user?.user_metadata?.['mobile'] ||
      (userData?.user?.email || "").split("@")[0]; // mobile-first auth maps 98xxxxxxx@phone.local
    const cleanPhone = rawPhone ? String(rawPhone).replace(/^\+?91/, "").replace(/\D/g, "").slice(-10) : "";
    const email = (profile as any)?.email || userData?.user?.email || "";

    // 1. Fetch orders owned by this user_id
    const { data: ownOrders } = await supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1000);

    // 2. Also fetch orders matching this phone/email (legacy/guest orders placed before login)
    let phoneOrders: any[] = [];
    if (cleanPhone && cleanPhone.length === 10) {
      const { data } = await supabase.from("orders").select("*").ilike("customer_phone", `%${cleanPhone}%`).order("created_at", { ascending: false }).limit(1000);
      phoneOrders = data || [];
    }
    if (email && !email.endsWith("@phone.local")) {
      const { data } = await supabase.from("orders").select("*").ilike("customer_email", email).order("created_at", { ascending: false }).limit(1000);
      phoneOrders = [...phoneOrders, ...(data || [])];
    }

    // Merge & dedupe
    const merged = [...(ownOrders || []), ...phoneOrders];
    const seen = new Set<string>();
    const unique = merged.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true; });
    unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setOrders(unique);
    setLoading(false);
  };

  const loadItems = async (orderId: string) => {
    if (expandedOrder === orderId) { setExpandedOrder(null); return; }
    if (!orderItems[orderId]) {
      const { data } = await supabase.from("order_items").select("*").eq("order_id", orderId);
      let items: any[] = data || [];
      // Enrich with variant/pack from orders.items JSON snapshot (order_items table has no variant column)
      const order = orders.find(o => o.id === orderId);
      const jsonItems = Array.isArray(order?.items) ? order!.items : [];
      if (items.length > 0 && jsonItems.length > 0) {
        items = items.map((it: any, idx: number) => {
          const match = jsonItems.find((j: any) =>
            (j.product_id && it.product_id && j.product_id === it.product_id && (j.name || j.product_name) === it.product_name)
          ) || jsonItems[idx];
          const variant = match?.variant || match?.pack || match?.size || match?.variation_label || "";
          return { ...it, variant };
        });
      } else if (items.length === 0 && jsonItems.length > 0) {
        items = jsonItems.map((j: any, idx: number) => ({
          id: `${orderId}-j-${idx}`,
          product_id: j.product_id || j.id || null,
          product_name: j.name || j.product_name || j.title || "Item",
          variant: j.variant || j.pack || j.size || j.variation_label || "",
          quantity: Number(j.quantity || j.qty || 1),
          price: Number(j['price'] || j.unit_price || 0),
        }));
      }
      setOrderItems(prev => ({ ...prev, [orderId]: items }));
    }
    setExpandedOrder(orderId);
  };

  const openCancelModal = (order: any) => {
    setCancelFor(order);
    setCancelReason("");
    setCancelOther("");
  };

  const submitCancel = async () => {
    if (!cancelFor || !cancelReason) {
      toast({ title: t("Please select a reason", "कृपया एक कारण चुनें"), variant: "destructive" });
      return;
    }
    const finalReason = cancelReason === "Others" ? (cancelOther.trim() || "Others") : cancelReason;
    setCancelSubmitting(true);
    const { error } = await supabase.from("orders").update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: finalReason,
      cancelled_by: "user",
    } as any).eq("id", cancelFor.id);
    setCancelSubmitting(false);
    if (error) { toast({ title: t("Cancel failed", "रद्द विफल"), description: error.message, variant: "destructive" }); return; }
    toast({ title: t("✅ Order cancelled", "✅ ऑर्डर रद्द हो गया") });
    setOrders(prev => prev.map(o => o.id === cancelFor.id ? { ...o, status: "cancelled", cancellation_reason: finalReason } : o));
    setCancelFor(null);
  };

  const submitReturn = async () => {
    if (!returnFor || !returnReason) {
      toast({ title: t("Please select a reason", "कृपया एक कारण चुनें"), variant: "destructive" });
      return;
    }
    setReturnSubmitting(true);
    const { error } = await supabase.from("returns" as any).insert({
      order_id: returnFor.id,
      order_number: returnFor.order_number,
      user_id: session.user.id,
      customer_name: returnFor.customer_name,
      customer_phone: returnFor.customer_phone,
      customer_email: returnFor.customer_email || null,
      return_type: "return",
      reason: returnReason,
      notes: returnNotes || null,
      status: "pending",
    });
    setReturnSubmitting(false);
    if (error) {
      toast({ title: t("Failed to submit", "सबमिट विफल"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("✅ Return request submitted", "✅ रिटर्न अनुरोध सबमिट हो गया") });
    setReturnFor(null); setReturnReason(""); setReturnNotes("");
  };

  const downloadInvoice = (order: any) => {
    const items = orderItems[order.id] || [];
    const date = new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    
    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Order Booking - ${order.id.slice(0, 8)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; background: #fff; padding: 40px; }
  .invoice { max-width: 700px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; border-bottom: 3px solid #3D8B37; padding-bottom: 14px; gap: 20px; }
  .brand { display: flex; align-items: flex-start; gap: 12px; }
  .brand-logo { width: 60px; height: 60px; border-radius: 10px; object-fit: contain; }
  .brand-text { font-size: 22px; font-weight: bold; color: #3D8B37; line-height: 1.1; }
  .brand-sub { font-size: 11px; color: #888; margin-top: 2px; }
  .company-info { font-size: 11px; color: #444; line-height: 1.5; margin-top: 6px; }
  .company-info strong { color: #1f2937; }
  .invoice-title { text-align: right; flex-shrink: 0; }
  .invoice-title h2 { font-size: 24px; color: #3D8B37; }
  .invoice-title p { font-size: 12px; color: #666; margin-top: 4px; }
  .info-grid { display: flex; justify-content: space-between; margin-bottom: 25px; }
  .info-box h4 { font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 6px; letter-spacing: 1px; }
  .info-box p { font-size: 13px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #3D8B37; color: #fff; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
  tr:nth-child(even) { background: #f9f9f9; }
  .total-row { border-top: 2px solid #3D8B37; }
  .total-row td { font-weight: bold; font-size: 15px; padding-top: 12px; }
  .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #999; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .badge-paid { background: #d4edda; color: #155724; }
  .badge-cod { background: #fff3cd; color: #856404; }
  @media print { body { padding: 20px; } .no-print { display: none; } }
</style>
</head><body>
<div class="invoice">
  <div class="header">
    <div class="brand">
      <img loading="lazy" decoding="async" src="${window.location.origin}/logo.png" class="brand-logo" onerror="this.style.display='none'" />
      <div>
        <div class="brand-text">Vedic Upchar Pvt Ltd</div>
        <div class="brand-sub">Authentic Ayurvedic Healthcare</div>
        <div class="company-info">
          <strong>GSTIN:</strong> 07AADCV8879J1ZI<br/>
          <strong>Address:</strong> 307/3, Shahzada Bagh, Industrial Area,<br/>
          Near Metro Pillar No.188, Ram Dharam Kanta Wali Gali,<br/>
          Inderlok, Delhi 110035<br/>
          📞 +91 8448797693 &nbsp;|&nbsp; ✉️ vedicupchar11@gmail.com
        </div>
      </div>
    </div>
    <div class="invoice-title">
      <h2>ORDER BOOKING</h2>
      <p>#${(order.order_number || order.id.slice(0, 8)).toUpperCase()}</p>
      <p>${date}</p>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <h4>Bill To</h4>
      <p><strong>${order.customer_name}</strong></p>
      <p>${order.address}</p>
      ${order.city || order.pincode ? `<p>${[order.city, order.pincode].filter(Boolean).join(", ")}</p>` : ""}
      <p>${order.customer_phone}</p>
      ${order.customer_email ? `<p>${order.customer_email}</p>` : ""}
    </div>
    <div class="info-box" style="text-align:right">
      <h4>Payment</h4>
      <p><span class="badge ${order.payment_status === 'paid' ? 'badge-paid' : 'badge-cod'}">${(order.payment_status || 'COD').toUpperCase()}</span></p>
      <h4 style="margin-top:12px">Status</h4>
      <p>${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</p>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Price</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      ${items.map((item: any, i: number) => `
        <tr>
          <td>${i + 1}</td>
          <td>${item.product_name}</td>
          <td>${item.quantity}</td>
          <td>₹${item['price']}</td>
          <td style="text-align:right">₹${(item['price'] * item.quantity).toLocaleString("en-IN")}</td>
        </tr>
      `).join("")}
      <tr class="total-row">
        <td colspan="4" style="text-align:right">Subtotal</td>
        <td style="text-align:right">₹${order.total.toLocaleString("en-IN")}</td>
      </tr>
      <tr>
        <td colspan="4" style="text-align:right; color:#3D8B37">Delivery</td>
        <td style="text-align:right; color:#3D8B37">FREE</td>
      </tr>
      <tr>
        <td colspan="4" style="text-align:right; font-size:16px"><strong>Total</strong></td>
        <td style="text-align:right; font-size:16px; color:#3D8B37"><strong>₹${order.total.toLocaleString("en-IN")}</strong></td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    <p>Thank you for shopping with VedicUpchar! 🌿</p>
    <p style="margin-top:4px">For queries: support@vedicupchar.com | +91 98765 43210</p>
  </div>
</div>
<script class="no-print">window.onload = () => window.print();</script>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) win.focus();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  if (loading) {
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
          <h2 className="text-xl font-bold mb-2">{t("Login to view your orders", "अपने ऑर्डर देखने के लिए लॉगिन करें")}</h2>
          <Link to="/auth" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition mt-4">
            <LogIn className="h-4 w-4" /> {t("Login / Sign Up", "लॉगिन / साइन अप")}
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      <TopBar /><SiteHeader />
      
      <div className="bg-muted/50 border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">{t("Home", "होम")}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{t("My Orders", "मेरे ऑर्डर")}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-10 max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">{t("My Orders", "मेरे ऑर्डर")} ({orders.length})</h1>

        <AccountEmail session={session} />

        {/* Search by mobile (for guest / legacy orders) */}
        <MobileSearch onSearch={async (mobile) => {
          const clean = mobile.replace(/\D/g, "").slice(-10);
          if (clean.length !== 10) { toast({ title: t("Enter a 10-digit mobile", "10 अंकों का मोबाइल"), variant: "destructive" }); return; }
          setLoading(true);
          const { data } = await supabase.from("orders").select("*").ilike("customer_phone", `%${clean}%`).order("created_at", { ascending: false }).limit(500);
          setOrders(data || []);
          setLoading(false);
          if (!data || data.length === 0) toast({ title: t("No orders found for this mobile", "इस मोबाइल पर ऑर्डर नहीं मिले") });
        }} onReset={() => fetchOrders(session.user.id)} />



        {orders.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">{t("No orders yet", "अभी तक कोई ऑर्डर नहीं")}</h2>
            <Link to="/products" className="text-primary hover:underline">{t("Browse Products", "उत्पाद देखें")}</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const cfg = statusConfig[order.status] || statusConfig['pending'];
              const StatusIcon = cfg.icon;
              return (
                <div key={order.id} className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="p-4 cursor-pointer hover:bg-muted/30 transition" onClick={() => loadItems(order.id)}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-extrabold text-base text-primary tracking-wide break-all">{order.order_number || `#${order.id.slice(0, 8)}`}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${cfg.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {t(cfg.label, cfg.labelHi)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>{new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                          <span className="font-bold text-primary">₹{order.total.toLocaleString("en-IN")}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                            {(order.payment_status || 'COD').toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to="/track-order" search={{ id: order.order_number || order.id.slice(0,8) }} onClick={e => e.stopPropagation()} className="text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {t("Track", "ट्रैक")}
                        </Link>
                        {(order.status === "pending" || order.status === "confirmed") && (
                          <button onClick={(e) => { e.stopPropagation(); openCancelModal(order); }}
                            className="text-xs bg-destructive/10 text-destructive border border-destructive/30 px-3 py-1.5 rounded-lg hover:bg-destructive/20 flex items-center gap-1">
                            <Ban className="h-3 w-3" /> {t("Cancel", "रद्द")}
                          </button>
                        )}
                        {order.status === "delivered" && (
                          <button onClick={(e) => { e.stopPropagation(); setReturnFor(order); setReturnReason(""); setReturnNotes(""); }}
                            className="text-xs bg-orange-100 text-orange-800 border border-orange-300 px-3 py-1.5 rounded-lg hover:bg-orange-200 flex items-center gap-1">
                            ↩ {t("Return", "वापसी")}
                          </button>
                        )}
                        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expandedOrder === order.id ? 'rotate-90' : ''}`} />
                      </div>
                    </div>
                  </div>

                  {expandedOrder === order.id && (
                    <div className="border-t border-border p-4 bg-muted/20">
                      {(order as any).customer_remark && (
                        <div className="mb-3 bg-primary/5 border border-primary/30 rounded-lg p-3">
                          <p className="text-[10px] uppercase font-semibold text-primary tracking-wide mb-1">📢 {t("Update from Vedic Upchar", "वेदिक उपचार से अपडेट")}</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{(order as any).customer_remark}</p>
                        </div>
                      )}
                      <div className="space-y-2 mb-4">
                        {(orderItems[order.id] || []).map((item: any) => (
                          <div key={item.id} className="py-2 border-b border-border last:border-0">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-sm font-medium">{item.product_name}</p>
                                {item.variant && (
                                  <span className="inline-block mt-0.5 text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">{item.variant}</span>
                                )}
                                <p className="text-xs text-muted-foreground mt-0.5">Qty: {item.quantity} × ₹{item['price']}</p>
                              </div>
                              <p className="font-bold text-sm text-primary">₹{(item['price'] * item.quantity).toLocaleString("en-IN")}</p>
                            </div>
                            {order.status === "delivered" && item.product_id && (
                              <ItemReview
                                productId={item.product_id}
                                productName={item.product_name}
                                userId={session.user.id}
                                userName={session.user.user_metadata?.['full_name'] || session.user.email?.split("@")[0] || "Customer"}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
                        <div className="text-sm">
                          <span className="text-muted-foreground">{t("Total:", "कुल:")}</span>
                          <span className="font-bold text-primary ml-2">₹{order.total.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(order.status === "pending" || order.status === "confirmed") && (
                            <button onClick={() => openCancelModal(order)} className="flex items-center gap-1.5 bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2 rounded-lg text-sm font-medium hover:bg-destructive/20 transition">
                              <Ban className="h-4 w-4" /> {t("Cancel Order", "ऑर्डर रद्द करें")}
                            </button>
                          )}
                          {order.status !== "cancelled" && (
                            <button onClick={() => downloadInvoice(order)} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
                              <Download className="h-4 w-4" />
                              {t("Download Invoice", "इनवॉइस डाउनलोड करें")}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cancelFor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !cancelSubmitting && setCancelFor(null)}>
          <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{t("Cancel Order", "ऑर्डर रद्द करें")}</h3>
              <button onClick={() => !cancelSubmitting && setCancelFor(null)} className="text-muted-foreground hover:text-foreground"><XIcon className="h-5 w-5" /></button>
            </div>
            <p className="text-sm font-semibold text-foreground mb-3">
              {t("What stopped you from completing your purchase?", "आपने ऑर्डर क्यों रद्द किया?")}
            </p>
            <div className="space-y-2 mb-4">
              {CANCEL_REASONS.map(r => (
                <label key={r.en} className={`flex items-start gap-2 p-3 rounded-lg border-2 cursor-pointer transition ${cancelReason === r.en ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  <input type="radio" name="cancel-reason" value={r.en} checked={cancelReason === r.en} onChange={e => setCancelReason(e.target.value)} className="mt-0.5" />
                  <span className="text-sm">{t(r.en, r.hi)}</span>
                </label>
              ))}
            </div>
            {cancelReason === "Others" && (
              <textarea value={cancelOther} onChange={e => setCancelOther(e.target.value)} rows={3}
                placeholder={t("Others (please specify)", "अन्य (कृपया बताएं)")}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background mb-4" />
            )}
            <div className="flex gap-2">
              <button onClick={() => !cancelSubmitting && setCancelFor(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">
                {t("Back", "वापस")}
              </button>
              <button onClick={submitCancel} disabled={cancelSubmitting || !cancelReason}
                className="flex-1 bg-cta text-cta-foreground px-4 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50">
                {cancelSubmitting ? t("Cancelling...", "रद्द हो रहा...") : t("Skip and exit", "छोड़ें और बाहर")}
              </button>
            </div>
          </div>
        </div>
      )}

      {returnFor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setReturnFor(null)}>
          <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{t("Return Request", "रिटर्न अनुरोध")}</h3>
              <button onClick={() => setReturnFor(null)} className="text-muted-foreground hover:text-foreground"><XIcon className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {t("Order", "ऑर्डर")}: <span className="font-mono font-semibold">#{returnFor.id.slice(0,8)}</span>
            </p>
            <label className="text-xs font-semibold text-foreground mb-2 block">{t("Reason for return *", "वापसी का कारण *")}</label>
            <div className="space-y-2 mb-4">
              {RETURN_REASONS.map((r) => (
                <label key={r.en} className={`flex items-start gap-2 p-3 rounded-lg border-2 cursor-pointer transition ${returnReason === r.en ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  <input type="radio" name="return-reason" value={r.en} checked={returnReason === r.en} onChange={e => setReturnReason(e.target.value)} className="mt-0.5" />
                  <span className="text-sm">{t(r.en, r.hi)}</span>
                </label>
              ))}
            </div>
            <label className="text-xs font-semibold text-foreground mb-1 block">{t("Additional details (optional)", "अतिरिक्त विवरण (वैकल्पिक)")}</label>
            <textarea value={returnNotes} onChange={e => setReturnNotes(e.target.value)} rows={3}
              placeholder={t("Any other information...", "कोई अन्य जानकारी...")}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setReturnFor(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">
                {t("Cancel", "रद्द")}
              </button>
              <button onClick={submitReturn} disabled={returnSubmitting || !returnReason}
                className="flex-1 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50">
                {returnSubmitting ? t("Submitting...", "सबमिट हो रहा है...") : t("Submit Request", "अनुरोध सबमिट करें")}
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
};

export default OrderHistoryPage;

// Search-by-mobile bar (helps view legacy/guest orders by phone)
function MobileSearch({ onSearch, onReset }: { onSearch: (m: string) => void; onReset: () => void }) {
  const [mobile, setMobile] = useState("");
  return (
    <div className="bg-card rounded-xl border border-border p-3 mb-4 flex flex-col sm:flex-row gap-2">
      <input value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
        inputMode="numeric" maxLength={10} placeholder="Search orders by mobile (10 digits)"
        className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:border-primary focus:outline-none" />
      <div className="flex gap-2">
        <button onClick={() => onSearch(mobile)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">Search</button>
        <button onClick={() => { setMobile(""); onReset(); }} className="border border-border px-4 py-2 rounded-lg text-sm font-semibold hover:bg-muted">Reset</button>
      </div>
    </div>
  );
}



// Inline component: account email update
function AccountEmail({ session }: { session: any }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const initialEmail = session?.user?.email && !session.user.email.endsWith("@phone.local") ? session.user.email : "";
  const [email, setEmail] = useState(initialEmail);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ title: t("Invalid email", "अमान्य ईमेल"), variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setSaving(false);
    if (error) { toast({ title: t("Update failed", "अपडेट विफल"), description: error.message, variant: "destructive" }); return; }
    toast({ title: t("✅ Email updated. Check your inbox to verify.", "✅ ईमेल अपडेट। सत्यापित करने के लिए अपना इनबॉक्स देखें।") });
    setEditing(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <Mail className="h-4 w-4 text-primary" />
        <span className="font-semibold">{t("Email", "ईमेल")}:</span>
        {editing ? (
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
            className="px-3 py-1.5 border border-border rounded-lg text-sm bg-background w-64" />
        ) : (
          <span className="text-muted-foreground">{initialEmail || t("Not set", "सेट नहीं")}</span>
        )}
      </div>
      {editing ? (
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-50">
            <Save className="h-3.5 w-3.5" /> {saving ? t("Saving...", "सहेज रहा है...") : t("Save", "सहेजें")}
          </button>
          <button onClick={() => { setEditing(false); setEmail(initialEmail); }} className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-xs">
            {t("Cancel", "रद्द")}
          </button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline font-medium">
          {initialEmail ? t("Update Email", "ईमेल अपडेट करें") : t("Add Email", "ईमेल जोड़ें")}
        </button>
      )}
    </div>
  );
}

// Inline component: per-item review (only shown for delivered orders)
function ItemReview({ productId, productName, userId, userName }: { productId: string; productName: string; userId: string; userName: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [existingReview, setExistingReview] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("product_reviews" as any)
        .select("id, rating, comment")
        .eq("product_id", productId)
        .eq("user_id", userId)
        .maybeSingle();
      setExistingReview(data || null);
      setChecking(false);
    })();
  }, [productId, userId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(e.target.files)) {
      if (file.size > 3 * 1024 * 1024) {
        toast({ title: t("Max 3MB per image", "अधिकतम 3MB प्रति छवि"), variant: "destructive" });
        continue;
      }
      const ext = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("review-images").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("review-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    setImages(prev => [...prev, ...urls].slice(0, 5));
    setUploading(false);
    e.target.value = "";
  };

  const submit = async () => {
    if (!comment.trim()) {
      toast({ title: t("Please write a review", "कृपया रिव्यू लिखें"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("product_reviews" as any).insert({
      product_id: productId,
      user_id: userId,
      user_name: userName,
      rating,
      title: title || null,
      comment,
      images,
      is_verified_purchase: true,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: t("Failed", "विफल"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("✅ Thanks for your review!", "✅ रिव्यू के लिए धन्यवाद!") });
    setExistingReview({ id: "new", rating, comment });
    setOpen(false);
  };

  if (checking) return null;

  if (existingReview) {
    return (
      <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary bg-primary/10 px-2 py-1 rounded-full">
        <CheckCircle className="h-3 w-3" />
        {t("You reviewed this product", "आपने इसे रिव्यू किया है")} ({existingReview.rating}★)
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-semibold hover:opacity-90"
      >
        <Star className="h-3 w-3" /> {t("Write Review", "रिव्यू लिखें")}
      </button>
    );
  }

  return (
    <div className="mt-3 bg-card border border-border rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">{t("Reviewing", "रिव्यू कर रहे हैं")}: {productName}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button key={i} onClick={() => setRating(i)} type="button">
            <Star className={`h-5 w-5 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={t("Title (optional)", "शीर्षक (वैकल्पिक)")}
        className="w-full px-2 py-1.5 border border-border rounded-lg text-xs bg-background"
      />
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={3}
        placeholder={t("Share your experience...", "अपना अनुभव साझा करें...")}
        className="w-full px-2 py-1.5 border border-border rounded-lg text-xs bg-background"
      />
      <div className="flex flex-wrap gap-1.5">
        {images.map((url, i) => (
          <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden border border-border">
            <img loading="lazy" decoding="async" src={url} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => setImages(images.filter((_, idx) => idx !== i))}
              className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5"
            >
              <XIcon className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
        {images.length < 5 && (
          <label className="w-12 h-12 rounded-lg border-2 border-dashed border-border hover:border-primary flex items-center justify-center cursor-pointer">
            {uploading ? (
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={submitting}
          className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
        >
          {submitting ? t("Submitting...", "सबमिट हो रहा है...") : t("Submit", "सबमिट")}
        </button>
        <button onClick={() => setOpen(false)} className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-xs">
          {t("Cancel", "रद्द")}
        </button>
      </div>
    </div>
  );
}
