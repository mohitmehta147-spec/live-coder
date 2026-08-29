import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "@tanstack/react-router";
import { useSearchParams } from "@/hooks/use-search-params";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Calendar, User, ArrowRight, Tag, Search, X } from "lucide-react";

const BlogsPage = () => {
  const { t, lang } = useLanguage();
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const searchQuery = searchParams.get("search") || "";

  useEffect(() => {
    supabase.from("blogs").select("*").eq("is_published", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setBlogs(data || []); setLoading(false); });
  }, []);

  const filteredBlogs = useMemo(() => {
    if (!searchQuery.trim()) return blogs;
    const q = searchQuery.trim().toLowerCase();
    return blogs.filter(b => {
      const hay = [b.title, b.title_hi, b.excerpt, b.excerpt_hi, b.content, b.category, (b.tags || []).join(" ")].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [blogs, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) setSearchParams({ search: searchInput.trim() });
    else setSearchParams({});
  };

  usePageMeta("Ayurvedic Health Blog - VedicUpchar", "Read expert Ayurvedic health tips, natural remedies, herbal medicine guides and wellness articles by VedicUpchar doctors.");

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <SiteHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">{t("Ayurvedic Health Blog", "आयुर्वेदिक स्वास्थ्य ब्लॉग")}</h1>
          <p className="text-muted-foreground">{t("Expert tips, natural remedies & wellness articles", "विशेषज्ञ टिप्स, प्राकृतिक उपचार और कल्याण लेख")}</p>
        </div>

        <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-8 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder={t("Search posts...", "पोस्ट खोजें...")}
            className="w-full pl-10 pr-24 py-3 border border-border rounded-xl text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30" />
          {searchQuery && (
            <button type="button" onClick={() => { setSearchInput(""); setSearchParams({}); }}
              className="absolute right-20 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-sm font-medium">
            {t("Search", "खोजें")}
          </button>
        </form>

        {searchQuery && (
          <p className="text-sm text-muted-foreground text-center mb-4">
            {filteredBlogs.length} {t("result(s) for", "परिणाम")} "<strong>{searchQuery}</strong>"
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="bg-card rounded-xl border border-border overflow-hidden animate-pulse">
                <div className="h-48 bg-muted" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredBlogs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">{searchQuery ? t("No posts match your search.", "कोई पोस्ट नहीं मिली।") : t("No blog posts yet. Stay tuned!", "अभी कोई ब्लॉग पोस्ट नहीं है। जल्द आ रहा है!")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBlogs.map(blog => (
              <Link key={blog.id} to="/blog/$slug" params={{ slug: blog.slug }}
                className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition group">
                {blog.image_url ? (
                  <img loading="lazy" decoding="async" src={blog.image_url} alt={blog.title}
                    onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.outerHTML = '<div class="h-48 bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center"><span class="text-4xl">📝</span></div>'; }}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="h-48 bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <span className="text-4xl">📝</span>
                  </div>
                )}
                <div className="p-5">
                  {blog.category && (
                    <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full mb-2">
                      <Tag className="h-3 w-3" /> {blog.category}
                    </span>
                  )}
                  <h2 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-primary transition">
                    {lang === "hi" && blog.title_hi ? blog.title_hi : blog.title}
                  </h2>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {lang === "hi" && blog.excerpt_hi ? blog.excerpt_hi : blog.excerpt}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {blog.author}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(blog.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    </div>
                    <span className="text-primary flex items-center gap-1 font-medium">
                      {t("Read", "पढ़ें")} <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
};

export default BlogsPage;
