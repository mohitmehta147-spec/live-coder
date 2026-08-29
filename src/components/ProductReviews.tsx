import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Star, Upload, X, CheckCircle2, Trash2, PenSquare } from "lucide-react";
import { Link } from "@tanstack/react-router";

type Review = {
  id: string; user_id: string; user_name: string; rating: number;
  title: string | null; comment: string | null; images: string[] | null;
  is_verified_purchase: boolean | null; created_at: string;
};

const ProductReviews = ({ productId }: { productId: string }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [filterRating, setFilterRating] = useState<number | "all">("all");
  const [withPhotos, setWithPhotos] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "high" | "low">("recent");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    const { data } = await supabase.from("product_reviews" as any)
      .select("*").eq("product_id", productId).order("created_at", { ascending: false });
    setReviews((data as any) || []);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setUploading(true);
    const urls: string[] = [];
    const folder = session?.user?.id || "guest";
    for (const file of Array.from(e.target.files)) {
      if (file.size > 3 * 1024 * 1024) { toast({ title: "Max 3MB per image", variant: "destructive" }); continue; }
      const ext = file.name.split(".").pop();
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
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
    if (!comment.trim()) { toast({ title: t("Please write a review", "कृपया रिव्यू लिखें"), variant: "destructive" }); return; }
    if (!session?.user && !guestName.trim()) { toast({ title: t("Please enter your name", "कृपया अपना नाम दर्ज करें"), variant: "destructive" }); return; }
    setSubmitting(true);

    let userName = guestName.trim() || "Guest";
    let verified = false;
    if (session?.user) {
      userName = session.user.user_metadata?.['full_name'] || session.user.email?.split("@")[0] || "User";
      const { data: userOrders } = await supabase.from("orders").select("id").eq("user_id", session.user.id);
      if (userOrders && userOrders.length > 0) {
        const orderIds = userOrders.map(o => o.id);
        const { data: purchasedItems } = await supabase.from("order_items").select("id").eq("product_id", productId).in("order_id", orderIds).limit(1);
        verified = !!(purchasedItems && purchasedItems.length > 0);
      }
    }

    const { error } = await supabase.from("product_reviews" as any).insert({
      product_id: productId,
      user_id: session?.user?.id || null,
      user_name: userName,
      rating, title: title || null, comment, images, is_verified_purchase: verified,
      status: "pending",
    });
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); }
    else {
      toast({
        title: t("✅ Review submitted!", "✅ रिव्यू सबमिट हो गया!"),
        description: t("Your review will appear once approved by our team.", "हमारी टीम द्वारा स्वीकृत होने पर आपका रिव्यू दिखाई देगा।"),
      });
      setShowForm(false); setTitle(""); setComment(""); setImages([]); setRating(5); setGuestName("");
      fetchReviews();
    }
    setSubmitting(false);
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Delete this review?")) return;
    await supabase.from("product_reviews" as any).delete().eq("id", id);
    fetchReviews();
  };

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "0";
  const distribution = [5, 4, 3, 2, 1].map(n => ({ stars: n, count: reviews.filter(r => r.rating === n).length }));

  return (
    <div className="container mx-auto px-4 py-8 border-t border-border">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold">{t("Customer Reviews", "ग्राहक रिव्यू")}</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition"
        >
          <PenSquare className="h-4 w-4" />
          {showForm ? t("Cancel", "रद्द करें") : t("Write a Review", "रिव्यू लिखें")}
        </button>
      </div>

      {reviews.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 bg-muted/30 rounded-xl p-5">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">{avgRating}</div>
            <div className="flex justify-center gap-0.5 my-2">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className={`h-4 w-4 ${i <= Math.round(Number(avgRating)) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
              ))}
            </div>
            <div className="text-xs text-muted-foreground">{reviews.length} {t("reviews", "रिव्यू")}</div>
          </div>
          <div className="md:col-span-2 space-y-1">
            {distribution.map(d => (
              <div key={d.stars} className="flex items-center gap-2 text-xs">
                <span className="w-12">{d.stars} ★</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400" style={{ width: `${reviews.length ? (d.count / reviews.length) * 100 : 0}%` }} />
                </div>
                <span className="w-8 text-right text-muted-foreground">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-card border border-border rounded-xl p-5 space-y-4">
          {!session && (
            <div>
              <label className="text-sm font-semibold block mb-1">{t("Your Name", "आपका नाम")}</label>
              <input value={guestName} onChange={e => setGuestName(e.target.value)} maxLength={60}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
                placeholder={t("Enter your name", "अपना नाम दर्ज करें")} />
            </div>
          )}
          <div>
            <label className="text-sm font-semibold block mb-1">{t("Your Rating", "आपकी रेटिंग")}</label>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(i => (
                <button key={i} type="button" onClick={() => setRating(i)}>
                  <Star className={`h-6 w-6 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1">{t("Title (optional)", "शीर्षक (वैकल्पिक)")}</label>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
              placeholder={t("Summarize your experience", "अपने अनुभव का सारांश दें")} />
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1">{t("Your Review", "आपका रिव्यू")}</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} maxLength={1000}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
              placeholder={t("Share what you liked or didn't like...", "आपको क्या पसंद आया या क्या नहीं...")} />
          </div>
          <div>
            <label className="text-sm font-semibold block mb-2">{t("Photos (up to 5, 3MB each)", "फोटो (5 तक, प्रत्येक 3MB)")}</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {images.map((url, i) => (
                <div key={i} className="relative w-16 h-16">
                  <img loading="lazy" decoding="async" src={url} alt="" className="w-full h-full rounded-lg object-cover border border-border" />
                  <button onClick={() => setImages(imgs => imgs.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <label className="w-16 h-16 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={submitting || uploading}
              className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {submitting ? t("Submitting...", "सबमिट हो रहा है...") : t("Submit Review", "रिव्यू सबमिट करें")}
            </button>
            <button onClick={() => setShowForm(false)} className="border border-border px-5 py-2 rounded-lg text-sm font-semibold hover:bg-muted">
              {t("Cancel", "रद्द करें")}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">{t("Loading...", "लोड हो रहा है...")}</p>
      ) : reviews.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-6">
          {t("No reviews yet. Be the first to review this product!", "अभी तक कोई रिव्यू नहीं। इस प्रोडक्ट का पहला रिव्यू लिखें!")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <select value={filterRating as any} onChange={e => setFilterRating(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs">
              <option value="all">{t("All ratings", "सभी रेटिंग")}</option>
              {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} ★</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs">
              <option value="recent">{t("Most recent", "सबसे नया")}</option>
              <option value="high">{t("Highest rated", "उच्चतम रेटिंग")}</option>
              <option value="low">{t("Lowest rated", "निम्नतम रेटिंग")}</option>
            </select>
            <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={withPhotos} onChange={e => setWithPhotos(e.target.checked)} />
              {t("With photos", "फोटो वाले")}
            </label>
            {(filterRating !== "all" || withPhotos || sortBy !== "recent") && (
              <button onClick={() => { setFilterRating("all"); setWithPhotos(false); setSortBy("recent"); }}
                className="text-xs text-muted-foreground underline">{t("Clear", "साफ़ करें")}</button>
            )}
          </div>
          <div className="space-y-4">
          {reviews
            .filter(r => filterRating === "all" || r.rating === filterRating)
            .filter(r => !withPhotos || (r.images && r.images.length > 0))
            .sort((a, b) => sortBy === "high" ? b.rating - a.rating : sortBy === "low" ? a.rating - b.rating : +new Date(b.created_at) - +new Date(a.created_at))
            .map(r => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{r.user_name}</span>
                    {r.is_verified_purchase && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3" /> {t("Verified", "सत्यापित")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </div>
                </div>
                {session?.user?.id === r.user_id && (
                  <button onClick={() => deleteReview(r.id)} className="p-1 hover:bg-destructive/10 rounded">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                )}
              </div>
              {r.title && <h4 className="font-semibold text-sm mb-1">{r.title}</h4>}
              {r.comment && <p className="text-sm text-foreground/90">{r.comment}</p>}
              {r.images && r.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {r.images.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img loading="lazy" decoding="async" src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-border hover:opacity-80" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ProductReviews;
