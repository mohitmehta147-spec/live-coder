import { withPackInfoAll } from "@/lib/packs";
import { mediaUrl, mediaUrls } from "@/lib/media";

function VariantImage({ src, alt }: { src?: string | null; alt?: string }) {
  const [failed, setFailed] = useState(false);
  const url = mediaUrl(src);
  if (!url || failed) {
    return <div className="w-full h-20 sm:h-24 flex items-center justify-center text-3xl bg-muted/30">🌿</div>;
  }
  return (
    <div className="w-full h-20 sm:h-24 bg-muted/40 flex items-center justify-center">
      <img src={url} alt={alt || ""} loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-contain p-1.5" />
    </div>
  );
}

import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Star, ShoppingCart, Truck, Shield, Package, ChevronRight, ChevronLeft, Minus, Plus, Check, Stethoscope, Share2, Sparkles } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import FeaturedProducts from "@/components/FeaturedProducts";
import ConsultationBanner from "@/components/ConsultationBanner";
import ImpactStats from "@/components/ImpactStats";
import MediaLogos from "@/components/MediaLogos";
import ProductReviews from "@/components/ProductReviews";
import ProductReels from "@/components/ProductReels";
import AnnouncementBar from "@/components/AnnouncementBar";
import LiveVisitors from "@/components/LiveVisitors";

import { useCountdownDiscount, productEligibleForDiscount, isDiscountActive } from "@/hooks/use-countdown-discount";

type FAQ = { q: string; a: string };
type Variation = { label: string; mrp: number; price: number; image?: string; tagline?: string; size?: string; per_unit?: string };
type Product = {
  id: string; name: string; name_hi: string | null; slug: string;
  description: string | null; description_hi: string | null;
  price: number; mrp: number; rating: number | null; reviews_count: number | null;
  image_url: string | null; images: string[] | null; badge: string | null;
  stock: number | null; sku: string | null; sizes: string[] | null;
  features: { icon: string; text: string }[];
  meta_title: string | null; meta_description: string | null;
  sale_price: number | null; sale_starts_at: string | null; sale_ends_at: string | null;
  banner_image: string | null; banner_image_mobile: string | null; banner_video_url: string | null; benefits_banner: string | null; benefits_banner_mobile: string | null; ingredients_banner: string | null; ingredients_banner_mobile: string | null; benefits: any; ingredients: any; how_to_use: string | null; faqs: any;
  category_id: string | null; product_type: string | null; variations: Variation[] | null;
};

const ProductDetail = () => {
  const { slug } = useParams({ strict: false }) as any;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<number>(0);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [saleTimer, setSaleTimer] = useState({ h: 0, m: 0, s: 0 });
  const [pincode, setPincode] = useState<string>(() => {
    try { return localStorage.getItem("user_pincode") || "201009"; } catch { return "201009"; }
  });
  const [editingPincode, setEditingPincode] = useState(false);
  const [pincodeDraft, setPincodeDraft] = useState<string>("");
  const [pincodeConfirmed, setPincodeConfirmed] = useState(false);
  const [marqueeSpeed, setMarqueeSpeed] = useState<number>(20);
  const { t, lang } = useLanguage();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const countdownCfg = useCountdownDiscount();


  usePageMeta(
    product?.meta_title || (product ? `${product.name} - Buy Online | VedicUpchar` : "Loading... | VedicUpchar"),
    product?.meta_description || product?.description?.slice(0, 155) || "Buy authentic Ayurvedic products online.",
    mediaUrl(product?.image_url || (product?.images && product.images[0])) || undefined
  );

  // Product JSON-LD (rich results: price, availability, star rating)
  useEffect(() => {
    if (!product) return;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "product-jsonld";
    el.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.meta_description || product.description?.replace(/<[^>]+>/g, "").slice(0, 300) || undefined,
      image: mediaUrls([product.image_url, ...(product.images || [])]).slice(0, 5),
      sku: product.sku || product.slug,
      brand: { "@type": "Brand", name: "VedicUpchar" },
      offers: {
        "@type": "Offer",
        priceCurrency: "INR",
        price: String(product['price'] ?? 0),
        availability: (product.stock ?? 1) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: window.location.href.split("#")[0],
      },
      ...(product.rating && (product.reviews_count || 0) > 0
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: String(product.rating),
              reviewCount: String(product.reviews_count),
            },
          }
        : {}),
    });
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, [product]);


  useEffect(() => {
    const fetchProduct = async () => {
      const { data } = await supabase.from("products").select("*").eq("slug", slug).single();
      if (data) {
        setProduct(data as unknown as Product);
        if ((data as any).sizes?.length > 0) setSelectedSize((data as any).sizes[0]);
      }
      setLoading(false);
    };
    fetchProduct();
  }, [slug]);

  // Read marquee speed from site settings
  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "product_marquee_speed").maybeSingle()
      .then(({ data }) => {
        const n = Number(data?.value);
        if (!Number.isNaN(n) && n > 0) setMarqueeSpeed(n);
      });
  }, []);


  // Sale countdown timer — always show; fallback to next Sunday midnight
  useEffect(() => {
    const getNextSunday = () => {
      const now = new Date();
      const day = now.getDay();
      const daysUntilSunday = day === 0 ? 7 : 7 - day;
      const nextSunday = new Date(now);
      nextSunday.setDate(now.getDate() + daysUntilSunday);
      nextSunday.setHours(23, 59, 59, 999);
      return nextSunday.getTime();
    };
    const endStr = product?.sale_ends_at || countdownCfg.endsAt;
    const end = endStr ? new Date(endStr).getTime() : getNextSunday();
    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0) { setSaleTimer({ h: 0, m: 0, s: 0 }); return; }
      setSaleTimer({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff / 60000) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [product?.sale_ends_at, countdownCfg.endsAt]);

  if (loading) return (
    <div className="min-h-screen bg-background">
      <TopBar /><SiteHeader />
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-1/3 mx-auto" /><div className="h-64 bg-muted rounded" /></div>
      </div>
    </div>
  );

  if (!product) return (
    <div className="min-h-screen bg-background">
      <TopBar /><SiteHeader />
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">{t("Product not found", "उत्पाद नहीं मिला")}</h2>
        <Link to="/" className="text-primary hover:underline">{t("Go back home", "होम पर जाएं")}</Link>
      </div>
      <SiteFooter />
    </div>
  );

  // Variation selection overrides product base price/mrp
  const variations: Variation[] = withPackInfoAll(
    Array.isArray(product['variations']) ? (product['variations'] as any[]) : [],
    (product as any).base_pack_size,
    (product as any).unit,
  ) as Variation[];

  const activeVar = variations[selectedVariation] || null;
  const baseMrp = activeVar ? Number(activeVar['mrp']) || Number(product['mrp']) : Number(product['mrp']) || 0;
  const basePrice = activeVar ? Number(activeVar['price']) || Number(product['price']) : Number(product['price']) || 0;

  // Sale schedule logic (sale_price can arrive as "0.00" — treat as no sale)
  const now = Date.now();
  const salePrice = Number(product.sale_price) || 0;
  const saleActive = !activeVar && salePrice > 0 &&
    (!product.sale_starts_at || new Date(product.sale_starts_at).getTime() <= now) &&
    (!product.sale_ends_at || new Date(product.sale_ends_at).getTime() >= now);
  let effectivePrice = saleActive ? salePrice : basePrice;
  // Countdown auto-discount
  const countdownActive = isDiscountActive(countdownCfg) && productEligibleForDiscount(countdownCfg, product);
  if (countdownActive) effectivePrice = Math.round(effectivePrice * (1 - countdownCfg.percent / 100));
  const discount = baseMrp > 0 && effectivePrice > 0 ? Math.round(((baseMrp - effectivePrice) / baseMrp) * 100) : 0;
  const allImages = Array.from(new Set(mediaUrls([product.image_url, ...(product.images || [])])));
  const name = lang === "hi" && product.name_hi ? product.name_hi : product.name;
  const description = lang === "hi" && product.description_hi ? product.description_hi : product.description;

  const outOfStock = product.stock !== null && (product.stock ?? 0) <= 0;

  const handleAddToCart = () => {
    if (outOfStock) return;
    addToCart({ id: product.id, name: product.name, name_hi: product.name_hi, price: effectivePrice, mrp: baseMrp, image_url: product.image_url, slug: product.slug }, quantity);
  };

  const handleBuyNow = () => {
    if (outOfStock) return;
    handleAddToCart();
    navigate({ to: "/checkout" });
  };


  const productUrl = `${window.location.origin}/product/${product.slug}`;
  const shareText = `${name} - ₹${product['price']} | ${t("Buy Now", "अभी खरीदें")}`;

  const shareLinks = [
    { name: "Facebook", icon: "📘", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}` },
    { name: "WhatsApp", icon: "💬", url: `https://wa.me/?text=${encodeURIComponent(shareText + " " + productUrl)}` },
    { name: "Twitter", icon: "🐦", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(productUrl)}` },
    { name: "Telegram", icon: "✈️", url: `https://t.me/share/url?url=${encodeURIComponent(productUrl)}&text=${encodeURIComponent(shareText)}` },
  ];

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(productUrl);
    setShowShareMenu(false);
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || `Buy ${product.name} - Authentic Ayurvedic product from VedicUpchar`,
    image: allImages.length > 0 ? allImages : undefined,
    sku: product.sku || undefined,
    brand: { "@type": "Brand", name: "VedicUpchar" },
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "INR",
      price: product['price'],
      availability: (product.stock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: "VedicUpchar" },
    },
    ...(product.rating && product.reviews_count ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.rating,
        reviewCount: product.reviews_count,
      },
    } : {}),
  };


  return (
    <div className="min-h-screen bg-background">
      <TopBar /><SiteHeader />
      <div className="bg-muted/50 border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary transition">{t("Home", "होम")}</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/products" className="hover:text-primary transition">{t("Products", "उत्पाद")}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium line-clamp-1">{name}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
          {/* Images */}
          <div className="space-y-4">
            <div
              className="relative rounded-2xl overflow-hidden aspect-square bg-muted flex items-center justify-center touch-pan-y select-none"
              style={{ WebkitTapHighlightColor: "transparent" }}
              onTouchStart={(e) => { (e.currentTarget as any)._sx = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                const sx = (e.currentTarget as any)._sx;
                if (sx == null || allImages.length < 2) return;
                const dx = e.changedTouches[0].clientX - sx;
                if (Math.abs(dx) > 40) {
                  setSelectedImage(dx < 0
                    ? (selectedImage + 1) % allImages.length
                    : (selectedImage - 1 + allImages.length) % allImages.length);
                }
              }}
            >
              {discount > 0 && (
                <span className="absolute top-4 left-4 bg-cta text-cta-foreground text-sm font-bold px-3 py-1 rounded-lg z-10">
                  {t(`Save ₹${baseMrp - effectivePrice}`, `₹${baseMrp - effectivePrice} बचाएं`)}
                </span>
              )}
              {product.badge && (
                <span className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full z-10">{product.badge}</span>
              )}

              {allImages.length > 0 ? (
                <img loading="lazy" decoding="async"
                  src={allImages[selectedImage]}
                  alt={name}
                  draggable={false}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }}
                  className="w-full h-full object-contain pointer-events-none"
                />
              ) : (
                <span className="text-8xl">🌿</span>
              )}
              {allImages.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
                  {allImages.map((_, i) => (
                    <button key={i} onClick={() => setSelectedImage(i)} aria-label={`Image ${i + 1}`}
                      className={`rounded-full transition-all ${i === selectedImage ? "w-2.5 h-2.5 bg-foreground" : "w-2 h-2 bg-foreground/30"}`} />
                  ))}
                </div>
              )}
            </div>

            {allImages.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                {allImages.map((img, i) => (
                  <button key={i} onClick={() => setSelectedImage(i)}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition ${i === selectedImage ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"}`}>
                    <img loading="lazy" decoding="async" src={img} alt={`${name} ${i + 1}`} onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }} className="w-full h-full object-contain p-1" />
                  </button>
                ))}
              </div>
            )}

          </div>

          {/* Info */}
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{name}</h1>
                {product.product_type && (
                  <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                    {product.product_type}
                  </span>
                )}

                {description && (() => {
                  const LIMIT = 180;
                  const isLong = description.length > LIMIT;
                  const visible = !isLong || showFullDescription ? description : description.slice(0, LIMIT).trimEnd() + "…";
                  return (
                    <div className="mt-2">
                      <p className="text-muted-foreground text-sm md:text-base whitespace-pre-line">{visible}</p>
                      {isLong && (
                        <button onClick={() => setShowFullDescription(v => !v)} className="text-primary text-sm font-semibold mt-1 hover:underline">
                          {showFullDescription ? t("Read less", "कम पढ़ें") : t("Read more", "और पढ़ें")}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
              {/* Share Button */}
              <div className="relative">
                <button onClick={() => setShowShareMenu(!showShareMenu)} className="p-2 rounded-lg hover:bg-muted transition" title="Share">
                  <Share2 className="h-5 w-5 text-muted-foreground" />
                </button>
                {showShareMenu && (
                  <div className="absolute right-0 top-10 bg-card border border-border rounded-xl shadow-lg p-3 z-50 min-w-[180px] space-y-1">
                    {shareLinks.map((link) => (
                      <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition text-sm text-foreground">
                        <span>{link.icon}</span> {link.name}
                      </a>
                    ))}
                    <button onClick={handleCopyLink}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition text-sm text-foreground w-full text-left">
                      <span>🔗</span> {t("Copy Link", "लिंक कॉपी करें")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {(product.rating ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => document.getElementById("product-reviews")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="flex items-center gap-2 cursor-pointer group text-left"
                aria-label={t("Go to reviews", "रिव्यू देखें")}
              >
                <div className="flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-1 rounded-lg text-sm font-bold">
                  <Star className="h-4 w-4 fill-current" /> {product.rating}
                </div>
                <span className="text-muted-foreground text-sm group-hover:text-primary group-hover:underline transition">| {(product.reviews_count || 0).toLocaleString()} {t("Reviews", "रिव्यू")}</span>
              </button>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <LiveVisitors />
              {(() => {
                // Stable per-product random "in carts" count (8-32)
                const seed = (product.id || product.slug || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
                const inCarts = 8 + (seed % 25);
                return (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full">
                    <ShoppingCart className="h-3 w-3" />
                    {inCarts} {t("in carts", "कार्ट में")}
                  </span>
                );
              })()}
            </div>

            {/* Price */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t("MRP (Inclusive of taxes)", "एमआरपी (सभी कर शामिल)")}</p>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl md:text-4xl font-bold text-foreground">₹{effectivePrice}</span>
                {baseMrp > effectivePrice && (
                  <>
                    <span className="text-lg text-muted-foreground line-through">₹{baseMrp}</span>
                    {discount > 0 && <span className="text-sm font-bold text-cta">{discount}% OFF</span>}
                  </>
                )}
              </div>
              {saleActive && product.sale_ends_at && (
                <p className="text-xs text-cta font-semibold mt-1">⏰ {t("Sale ends", "सेल समाप्त")} {new Date(product.sale_ends_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>
              )}
              {discount > 0 && <p className="text-sm text-primary font-medium mt-1">{t(`You save ₹${baseMrp - effectivePrice}`, `आप ₹${baseMrp - effectivePrice} बचाएंगे`)}</p>}
            </div>

            {/* Promo marquee under price */}
            {(() => {
              const promos = [
                t("Free Delivery On All Orders Above ₹499", "₹499 से ऊपर के सभी ऑर्डर पर मुफ्त डिलीवरी"),
                t("100% Ayurvedic & Herbal Product", "100% आयुर्वेदिक और हर्बल उत्पाद"),
                t("INDIA's Most Trusted Ayurvedic Brand", "भारत का सबसे विश्वसनीय आयुर्वेदिक ब्रांड"),
                t('5% OFF, Code "SAVE5" (order above ₹499)', '5% छूट, कोड "SAVE5" (₹499 से ऊपर के ऑर्डर पर)'),
              ];
              const repeated = Array.from({ length: 3 }).flatMap(() => promos);
              const renderGroup = (k: string) => repeated.map((msg, i) => (
                <span key={`${k}-${i}`} className="font-semibold text-xs sm:text-sm inline-flex items-center px-6 border-l border-dashed border-current/40 shrink-0">{msg}</span>
              ));
              return (
                <div className="relative overflow-hidden rounded-xl bg-primary text-primary-foreground py-2">
                  <div className="flex whitespace-nowrap animate-marquee w-max" style={{ animationDuration: `${marqueeSpeed}s` }}>
                    <div className="flex shrink-0">{renderGroup("a")}</div>
                    <div className="flex shrink-0" aria-hidden="true">{renderGroup("b")}</div>
                  </div>
                </div>
              );
            })()}


            {/* Sale Countdown - always show */}
            {(saleTimer.h + saleTimer.m + saleTimer.s > 0) && (
              <div className="bg-primary/5 border-2 border-primary/30 rounded-2xl p-4 text-center">
                <p className="text-sm font-semibold text-primary mb-3">{t("Hurry Up! Sale ends in", "जल्दी करें! सेल समाप्त हो रही है")}</p>
                <div className="flex items-center justify-center gap-2 md:gap-3">
                  {[
                    { v: saleTimer.h, l: t("hours", "घंटे") },
                    { v: saleTimer.m, l: t("minutes", "मिनट") },
                    { v: saleTimer.s, l: t("seconds", "सेकंड") },
                  ].map((tt, i, arr) => (
                    <div key={i} className="flex items-center gap-2 md:gap-3">
                      <div className="flex flex-col items-center">
                        <div className="border-2 border-primary rounded-xl w-16 h-16 md:w-20 md:h-20 flex items-center justify-center text-2xl md:text-3xl font-bold text-primary tabular-nums bg-background">
                          {String(tt.v).padStart(2, "0")}
                        </div>
                        <span className="text-xs text-primary/80 mt-1">{tt.l}</span>
                      </div>
                      {i < arr.length - 1 && <span className="text-2xl md:text-3xl font-bold text-primary">:</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trust badges / Custom features */}
            {Array.isArray(product.features) && product.features.length > 0 && (
              <div className="border-2 border-dashed border-primary/30 rounded-xl p-3">
                <div className="flex flex-wrap gap-4 text-xs md:text-sm">
                  {product.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-primary">
                      <span>{f.icon}</span> {f.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Variations - card grid or pill buttons */}
            {variations.length > 0 && (() => {
              const pAny = product as any;
              const isPill = (pAny.variation_display || "card") === "pill";
              const unit = String(pAny.unit || "").toLowerCase().trim();
              const unitLabels: Record<string, { en: string; hi: string }> = {
                ml:       { en: "Size (ML)",     hi: "साइज़ (एमएल)" },
                ltr:      { en: "Size (Litre)",  hi: "साइज़ (लीटर)" },
                l:        { en: "Size (Litre)",  hi: "साइज़ (लीटर)" },
                gm:       { en: "Size (GM)",     hi: "साइज़ (ग्राम)" },
                g:        { en: "Size (GM)",     hi: "साइज़ (ग्राम)" },
                kg:       { en: "Size (KG)",     hi: "साइज़ (केजी)" },
                cap:      { en: "Capsules",      hi: "कैप्सूल" },
                capsule:  { en: "Capsules",      hi: "कैप्सूल" },
                capsules: { en: "Capsules",      hi: "कैप्सूल" },
                tab:      { en: "Tablets",       hi: "टैबलेट्स" },
                tablet:   { en: "Tablets",       hi: "टैबलेट्स" },
                tablets:  { en: "Tablets",       hi: "टैबलेट्स" },
                piece:    { en: "Pieces",        hi: "पीस" },
                pcs:      { en: "Pieces",        hi: "पीस" },
                pack:     { en: "Choose Pack",   hi: "पैक चुनें" },
              };
              const fallback = unitLabels[unit] || { en: "Choose Variant", hi: "वेरिएंट चुनें" };
              const customLabel = (pAny.variation_label || "").trim();
              const headingEn = customLabel || fallback.en;
              const headingHi = customLabel || fallback.hi;

              if (isPill) {
                return (
                  <div>
                    <span className="font-medium text-sm mb-2 block">{t(headingEn, headingHi)}</span>
                    <div className="flex flex-wrap gap-2">
                      {variations.map((v, i) => {
                        const isActive = selectedVariation === i;
                        return (
                          <button key={i} onClick={() => setSelectedVariation(i)}
                            className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition ${isActive ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-border bg-card text-foreground hover:border-primary/50"}`}>
                            {v.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <div>
                  <span className="font-medium text-sm mb-2 block">{t(headingEn, headingHi)}</span>
                <div className="grid grid-cols-3 gap-2">
                  {variations.map((v, i) => {
                    const isActive = selectedVariation === i;
                    const save = (Number(v['mrp']) || 0) - (Number(v['price']) || 0);
                    return (
                      <button key={i} onClick={() => setSelectedVariation(i)}
                        className={`relative rounded-2xl border-2 text-center overflow-hidden transition flex flex-col ${isActive ? "border-primary shadow-lg" : "border-border bg-card hover:border-primary/50"}`}>
                        {/* Title bar */}
                        <div className={`text-[11px] sm:text-xs font-bold px-1.5 py-2 leading-tight min-h-[44px] flex items-center justify-center ${isActive ? "bg-primary/15 text-primary" : "bg-muted text-foreground"}`}>
                          {v.label}
                        </div>
                        {/* Image */}
                        <VariantImage src={v.image} alt={v.label} />

                        {/* Price block */}
                        <div className="px-1.5 pb-2 flex-1 flex flex-col items-center">
                          <div className="font-extrabold text-lg sm:text-xl text-foreground leading-none">₹{v['price']}</div>
                          {v['mrp'] > v['price'] && (
                            <div className="text-[11px] text-muted-foreground line-through mt-1">₹{v['mrp']}</div>
                          )}
                          {(v.size || v.per_unit) && (
                            <div className="text-[10px] sm:text-[11px] text-foreground/80 mt-1 font-medium whitespace-nowrap">
                              {v.size}{v.per_unit && <span className="text-muted-foreground"> ({v.per_unit})</span>}
                            </div>
                          )}
                          {save > 0 && (
                            <div className="mt-1.5 bg-cta/10 text-cta text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {t(`Save ₹${save}`, `₹${save} बचाएं`)}
                            </div>
                          )}
                        </div>
                        {/* Bottom tagline - premium gradient ribbon */}
                        {v.tagline && (
                          <div className={`relative overflow-hidden text-[10px] sm:text-[11px] font-extrabold py-2 px-1.5 leading-tight tracking-wide flex items-center justify-center gap-1 ${isActive
                            ? "bg-[linear-gradient(135deg,#047857_0%,#059669_50%,#16a34a_100%)] text-white shadow-inner"
                            : "bg-[linear-gradient(135deg,#b45309_0%,#d97706_50%,#92400e_100%)] text-white"}`}>
                            <Sparkles className="h-3 w-3 shrink-0 drop-shadow text-yellow-200" />
                            <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] uppercase">{v.tagline}</span>
                            <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-linear-to-r from-transparent via-white/40 to-transparent" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              );
            })()}

            {/* Standalone sizes removed — sizes now part of Variations */}


            {/* Quantity */}
            <div>
              <span className="font-medium text-sm mb-2 block">{t("Quantity", "मात्रा")}</span>
              <div className="inline-flex items-center border-2 border-border rounded-xl overflow-hidden">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-2.5 hover:bg-muted transition"><Minus className="h-4 w-4" /></button>
                <span className="px-5 py-2.5 font-bold text-lg border-x border-border">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="px-4 py-2.5 hover:bg-muted transition"><Plus className="h-4 w-4" /></button>
              </div>
            </div>

            {/* Buttons - improved for mobile (more horizontal breathing room) */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleAddToCart} disabled={outOfStock}
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 sm:px-5 py-3.5 md:py-4 rounded-xl font-bold text-[13px] sm:text-sm md:text-base hover:opacity-90 transition min-h-[52px] disabled:opacity-50 disabled:cursor-not-allowed tracking-wide leading-tight whitespace-nowrap">
                <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 shrink-0" /> <span>{outOfStock ? t("OUT OF STOCK", "स्टॉक खत्म") : t("ADD TO CART", "कार्ट में डालें")}</span>
              </button>
              <button onClick={handleBuyNow} disabled={outOfStock}
                className="flex items-center justify-center gap-2 bg-cta hover:bg-cta/90 text-cta-foreground px-4 sm:px-5 py-3.5 md:py-4 rounded-xl font-bold text-[13px] sm:text-sm md:text-base hover:opacity-90 transition min-h-[52px] disabled:opacity-50 disabled:cursor-not-allowed tracking-wide leading-tight whitespace-nowrap shadow-md">
                <span>{outOfStock ? t("UNAVAILABLE", "अनुपलब्ध") : t("BUY NOW", "अभी खरीदें")}</span>
                {!outOfStock && (
                  <span className="flex items-center -space-x-1 ml-1">
                    <span className="bg-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-extrabold border border-black/10 shadow-sm" title="GPay">
                      <span style={{ background: "linear-gradient(90deg,#4285F4 0 25%,#EA4335 25% 50%,#FBBC04 50% 75%,#34A853 75% 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>G</span>
                    </span>
                    <span className="bg-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-extrabold text-[#5F259F] border border-black/10 shadow-sm" title="PhonePe" style={{ fontFamily: "system-ui" }}>पे</span>
                    <span className="bg-white rounded-full w-5 h-5 flex items-center justify-center border border-black/10 shadow-sm" title="Paytm">
                      <span className="text-[6px] font-extrabold leading-none tracking-tight"><span className="text-[#002970]">pay</span><span className="text-[#00BAF2]">tm</span></span>
                    </span>
                  </span>
                )}
              </button>
            </div>

            {/* Consultation Banner */}
            <Link to="/consultation" className="block bg-linear-to-r from-primary/90 to-primary rounded-2xl p-5 text-primary-foreground relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-lg md:text-xl font-bold leading-tight">{t("TOP AYURVEDIC DOCTORS", "शीर्ष आयुर्वेदिक डॉक्टर")}</h3>
                <h3 className="text-lg md:text-xl font-bold">{t("NOW ONLINE", "अब ऑनलाइन")}</h3>
                <p className="text-sm mt-1 opacity-90 italic">{t("Because Your Health Can't Wait", "क्योंकि आपका स्वास्थ्य इंतजार नहीं कर सकता")}</p>
                <span className="inline-flex items-center gap-1.5 bg-cta text-cta-foreground px-4 py-2 rounded-lg text-sm font-bold mt-3">
                  <Stethoscope className="h-4 w-4" /> {t("Consult Now", "अभी परामर्श करें")}
                </span>
              </div>
            </Link>

            {/* Stock + Delivery */}
            {outOfStock ? (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-destructive rounded-full" />
                <span className="text-sm text-destructive font-medium">{t("Currently out of stock", "अभी स्टॉक में नहीं")}</span>
              </div>
            ) : product.stock !== null && product.stock > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-primary rounded-full" />
                <span className="text-sm text-primary font-medium">{t("In stock - Ready to be shipped", "स्टॉक में - शिप होने के लिए तैयार")}</span>
              </div>
            )}


            {(() => {
              const isDelhi = pincode.startsWith("110");
              const etaHours = isDelhi ? 24 : 72;
              const etaLabel = isDelhi
                ? t("Delivery within 24 Hours", "24 घंटे में डिलीवरी")
                : t("Delivery within 72 Hours", "72 घंटे में डिलीवरी");
              const etaDate = new Date(Date.now() + etaHours * 3600 * 1000)
                .toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
              return (
                <div className="rounded-2xl overflow-hidden border border-primary/30 bg-card shadow-sm">
                  <div className="bg-cta text-cta-foreground px-3 py-2 text-xs sm:text-sm font-semibold flex items-center justify-between">
                    <ChevronLeft className="h-3.5 w-3.5 opacity-80" />
                    <span>{t("Check Delivery Date", "डिलीवरी तिथि जांचें")}</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-80" />
                  </div>
                  <div className="px-3 pt-3 pb-2.5">
                    <p className="text-xs sm:text-sm font-semibold text-foreground mb-2.5">{t("Estimated Delivery", "अनुमानित डिलीवरी")} <span className="text-primary font-bold">— {etaDate}</span></p>
                    <div className="grid grid-cols-2 gap-2.5 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-md border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 24 24" className="w-3 h-3 text-primary" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        </span>
                        {editingPincode ? (
                          <div className="flex items-center gap-1 w-full">
                            <input
                              autoFocus
                              value={pincodeDraft}
                              onChange={(e) => setPincodeDraft(e.target.value.replace(/\D/g, "").slice(0, 6))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && /^\d{6}$/.test(pincodeDraft)) {
                                  setPincode(pincodeDraft);
                                  try { localStorage.setItem("user_pincode", pincodeDraft); } catch {}
                                  setEditingPincode(false);
                                  setPincodeConfirmed(true);
                                  setTimeout(() => setPincodeConfirmed(false), 2500);
                                }
                              }}
                              className="w-full bg-transparent outline-none text-xs font-medium text-foreground border-b border-primary/40"
                              maxLength={6}
                              placeholder="6-digit pincode"
                              inputMode="numeric"
                            />
                            <button
                              type="button"
                              disabled={!/^\d{6}$/.test(pincodeDraft)}
                              onClick={() => {
                                setPincode(pincodeDraft);
                                try { localStorage.setItem("user_pincode", pincodeDraft); } catch {}
                                setEditingPincode(false);
                                setPincodeConfirmed(true);
                                setTimeout(() => setPincodeConfirmed(false), 2500);
                              }}
                              className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-md hover:opacity-90 disabled:opacity-40"
                            >
                              {t("Check", "जांचें")}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-foreground inline-flex items-center gap-1">
                            {pincode}
                            {pincodeConfirmed && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-primary text-primary-foreground px-1 py-0.5 rounded-full">
                                <Check className="h-2.5 w-2.5" /> {t("Confirmed", "पुष्टि")}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-md border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 24 24" className="w-3 h-3 text-primary" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        </span>
                        <span className="text-[11px] sm:text-xs text-foreground font-semibold leading-tight">{etaLabel}</span>
                      </div>
                    </div>
                    <button onClick={() => { setPincodeDraft(pincode); setEditingPincode(true); }} className="text-primary font-semibold text-xs hover:underline">
                      {t("Change pincode", "पिनकोड बदलें")}
                    </button>
                  </div>
                  <div className="border-t border-border px-3 py-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M12 2l2.39 4.84L20 8l-4 3.9.94 5.5L12 14.77 7.06 17.4 8 11.9 4 8l5.61-1.16L12 2z"/></svg>
                    </span>
                    <p className="text-[11px] sm:text-xs text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                      {t("Get 5% Off Your Entire Cart! 🛒 Apply", "अपने पूरे कार्ट पर 5% छूट! 🛒 लगाएँ")} <span className="font-bold">SAVE5</span>
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      {/* Product Banner Images & Video — mobile-specific images if provided, else desktop */}
      {(product.banner_image || product.banner_image_mobile || product.banner_video_url) && (
        <div className="w-full mt-2 flex flex-col">
          {(() => {
            const desktopUrls = (product.banner_image || "").split(/\n|,|\|/).map(u => u.trim()).filter(Boolean);
            const mobileUrls = (product.banner_image_mobile || "").split(/\n|,|\|/).map(u => u.trim()).filter(Boolean);
            const mobileList = mobileUrls.length > 0 ? mobileUrls : desktopUrls;
            const desktopList = desktopUrls.length > 0 ? desktopUrls : mobileUrls;
            return (
              <>
                <div className="md:hidden flex flex-col">
                  {mobileList.map((url, i) => (
                    <img key={`m-${i}`} src={url} alt={`${name} banner ${i + 1}`} className="block w-full h-auto" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ))}
                </div>
                <div className="hidden md:flex md:flex-col">
                  {desktopList.map((url, i) => (
                    <img key={`d-${i}`} src={url} alt={`${name} banner ${i + 1}`} className="block w-full h-auto" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ))}
                </div>
              </>
            );
          })()}





          {product.banner_video_url && (() => {
            const url = product.banner_video_url.trim();
            let embed: string | null = null;
            const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/);
            if (yt) embed = `https://www.youtube.com/embed/${yt[1]}`;
            const ig = url.match(/instagram\.com\/(?:reel|p)\/([\w-]+)/);
            if (!embed && ig) embed = `https://www.instagram.com/p/${ig[1]}/embed`;
            if (!embed) return null;
            return (
              <div className="w-full aspect-video bg-black">
                <iframe src={embed} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title={`${name} video`} />
              </div>
            );
          })()}
        </div>
      )}

      {/* Benefits */}
      {(product.benefits_banner || (Array.isArray(product.benefits) && product.benefits.length > 0)) && (
        <section className={product.benefits_banner ? "w-full" : "container mx-auto px-4 mt-10"}>
          {!product.benefits_banner && <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-center">{t("Key Benefits", "मुख्य लाभ")}</h2>}
          {product.benefits_banner ? (
            <>
              <img src={product.benefits_banner_mobile || product.benefits_banner} alt={`${name} key benefits`} loading="lazy"
                className="block w-full h-auto md:hidden" />
              <img src={product.benefits_banner} alt={`${name} key benefits`} loading="lazy"
                className="hidden md:block w-full h-auto" />
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {product.benefits.map((b: any, i: number) => {
                const icon = typeof b === "object" ? (b.icon || "✅") : "✅";
                const title = typeof b === "object" ? (b.title || b.text || "") : String(b);
                const desc = typeof b === "object" ? (b.description || "") : "";
                const image = typeof b === "object" ? (b.image || "") : "";
                return (
                  <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition">
                    {image ? (
                      <img src={image} alt={title || `${name} benefit`} className="w-full aspect-[16/10] object-cover" loading="lazy" />
                    ) : (
                      <div className="text-3xl px-5 pt-5">{icon}</div>
                    )}
                    <div className="p-5">
                      <h3 className="font-bold text-foreground mb-1">{title}</h3>
                      {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Ingredients */}
      {(product.ingredients_banner || (Array.isArray(product.ingredients) && product.ingredients.length > 0)) && (
        <section className={product.ingredients_banner ? "w-full" : "container mx-auto px-4 mt-10"}>
          {!product.ingredients_banner && <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-center">{t("Key Ingredients", "मुख्य सामग्री")}</h2>}
          {product.ingredients_banner ? (
            <>
              <img src={product.ingredients_banner_mobile || product.ingredients_banner} alt={`${name} key ingredients`} loading="lazy"
                className="block w-full h-auto md:hidden" />
              <img src={product.ingredients_banner} alt={`${name} key ingredients`} loading="lazy"
                className="hidden md:block w-full h-auto" />
            </>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {product.ingredients.map((ing: any, i: number) => {
                const icon = typeof ing === "object" ? (ing.icon || "🌿") : "🌿";
                const title = typeof ing === "object" ? (ing.name || ing.title || "") : String(ing);
                const desc = typeof ing === "object" ? (ing.description || "") : "";
                const image = typeof ing === "object" ? (ing.image || "") : "";
                return (
                  <div key={i} className="bg-secondary/30 border border-border rounded-2xl overflow-hidden text-center">
                    {image ? (
                      <img src={image} alt={title || `${name} ingredient`} className="w-full aspect-[16/10] object-cover" loading="lazy" />
                    ) : (
                      <div className="text-4xl pt-4">{icon}</div>
                    )}
                    <div className="p-4">
                      <h4 className="font-semibold text-foreground text-sm mb-1">{title}</h4>
                      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* How to Use */}
      {product.how_to_use && (
        <section className="container mx-auto px-4 mt-10">
          <div className="bg-linear-to-br from-primary/5 to-cta/5 border border-primary/20 rounded-2xl p-6 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 text-center">{t("How to Use", "उपयोग कैसे करें")}</h2>
            <div className="prose prose-sm max-w-none text-foreground whitespace-pre-line">{product.how_to_use}</div>
          </div>
        </section>
      )}

      {/* FAQs */}
      {Array.isArray(product.faqs) && product.faqs.length > 0 && (
        <section className="container mx-auto px-4 mt-10">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-center">{t("Frequently Asked Questions", "अक्सर पूछे जाने वाले प्रश्न")}</h2>
          <div className="max-w-3xl mx-auto space-y-3">
            {product.faqs.map((faq: FAQ, i: number) => (
              <details key={i} className="bg-card border border-border rounded-xl group">
                <summary className="cursor-pointer p-4 font-semibold text-foreground flex items-center justify-between">
                  <span>{faq.q}</span>
                  <span className="text-primary group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground whitespace-pre-line">{faq.a}</div>
              </details>
            ))}
          </div>
        </section>
      )}

      <ProductReels slug={product.slug} />
      <div id="product-reviews" className="scroll-mt-24">
        <ProductReviews productId={product.id} />
      </div>
      <FeaturedProducts />
      <ConsultationBanner />
      <ImpactStats />
      <MediaLogos />
      <SiteFooter />
    </div>
  );
};

export default ProductDetail;
