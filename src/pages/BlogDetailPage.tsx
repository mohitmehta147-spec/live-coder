import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { useParams, Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import TopBar from "@/components/TopBar";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Calendar, User, ChevronRight, Tag, Eye, Search } from "lucide-react";

const SocialShare = ({ url, title }: { url: string; title: string }) => {
  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  return (
    <div className="flex items-center gap-2">
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`} target="_blank" rel="noopener noreferrer"
        className="w-8 h-8 rounded-full bg-[#1877F2] text-white flex items-center justify-center hover:opacity-80 transition text-xs font-bold">f</a>
      <a href={`https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}`} target="_blank" rel="noopener noreferrer"
        className="w-8 h-8 rounded-full bg-[#1DA1F2] text-white flex items-center justify-center hover:opacity-80 transition text-xs font-bold">𝕏</a>
      <a href={`https://www.linkedin.com/shareArticle?mini=true&url=${encoded}&title=${encodedTitle}`} target="_blank" rel="noopener noreferrer"
        className="w-8 h-8 rounded-full bg-[#0A66C2] text-white flex items-center justify-center hover:opacity-80 transition text-xs font-bold">in</a>
      <a href={`https://api.whatsapp.com/send?text=${encodedTitle}%20${encoded}`} target="_blank" rel="noopener noreferrer"
        className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center hover:opacity-80 transition text-xs font-bold">W</a>
      <a href={`https://pinterest.com/pin/create/button/?url=${encoded}&description=${encodedTitle}`} target="_blank" rel="noopener noreferrer"
        className="w-8 h-8 rounded-full bg-[#E60023] text-white flex items-center justify-center hover:opacity-80 transition text-xs font-bold">P</a>
      <a href={`mailto:?subject=${encodedTitle}&body=${encoded}`}
        className="w-8 h-8 rounded-full bg-muted-foreground text-white flex items-center justify-center hover:opacity-80 transition text-xs font-bold">✉</a>
    </div>
  );
};

const BlogDetailPage = () => {
  const { slug } = useParams({ strict: false }) as any;
  const { t, lang } = useLanguage();
  const [blog, setBlog] = useState<any>(null);
  const [recentBlogs, setRecentBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  usePageMeta(
    blog?.meta_title || (blog ? `${blog.title} - VedicUpchar Blog` : "Loading... | VedicUpchar"),
    blog?.meta_description || blog?.excerpt || ""
  );

  useEffect(() => {
    if (!slug) return;
    supabase.from("blogs").select("*").eq("slug", slug).eq("is_published", true).maybeSingle()
      .then(({ data }) => {
        setBlog(data);
        setLoading(false);
        if (data) {
          supabase.from("blogs").update({ views_count: (data.views_count || 0) + 1 }).eq("id", data.id).then(() => {});
        }
      });
  }, [slug]);

  useEffect(() => {
    supabase.from("blogs").select("id,title,title_hi,slug,image_url,created_at,author")
      .eq("is_published", true).order("created_at", { ascending: false }).limit(6)
      .then(({ data }) => setRecentBlogs(data || []));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar /><SiteHeader />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading...</div>
        <SiteFooter />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar /><SiteHeader />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-2">{t("Blog not found", "ब्लॉग नहीं मिला")}</h1>
          <Link to="/blog" className="text-primary hover:underline">{t("Back to Blog", "ब्लॉग पर वापस")}</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const decodeEntities = (s: string) => {
    if (!s) return s;
    const txt = typeof document !== "undefined" ? document.createElement("textarea") : null;
    if (txt) { txt.innerHTML = s; return txt.value; }
    return s;
  };
  const title = decodeEntities(lang === "hi" && blog.title_hi ? blog.title_hi : blog.title);
  const content = lang === "hi" && blog.content_hi ? blog.content_hi : blog.content;
  const pageUrl = window.location.href;

  const filteredRecent = recentBlogs.filter(b => b.id !== blog?.id);

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <SiteHeader />

      {/* Breadcrumb */}
      <div className="bg-muted/50 border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">{t("Home", "होम")}</Link>
            <ChevronRight className="h-3 w-3" />
            {blog.category && (
              <>
                <span className="hover:text-primary">{blog.category}</span>
                <ChevronRight className="h-3 w-3" />
              </>
            )}
            <span className="text-foreground font-medium line-clamp-1">{title}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <article className="lg:col-span-2">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4 leading-tight">{title}</h1>

            {/* Meta + Share */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-border">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  {blog.author || "admin"}
                </span>
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(blog.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                {blog.category && (
                  <span className="text-xs">Categories: <span className="text-primary font-medium">{blog.category}</span></span>
                )}
              </div>
              <SocialShare url={pageUrl} title={title} />
            </div>

            {/* Featured Image */}
            {blog.image_url && (
              <img loading="lazy" decoding="async" src={blog.image_url} alt={title} className="w-full rounded-xl mb-6 object-cover max-h-[400px]" />
            )}

            {/* Blog Content - interspersed with gallery images (Text + Photo + Text + Photo) */}
            {(() => {
              const rawHtml = content || "";
              const html = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
              const contentHasImages = /<img\b/i.test(html);
              const gallery = (Array.isArray(blog.images) ? blog.images : []).filter((u: string) => u && u !== blog.image_url);
              const proseClass = "prose prose-sm sm:prose lg:prose-lg max-w-none text-foreground prose-headings:text-foreground prose-headings:font-bold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-p:leading-relaxed prose-p:mb-4 prose-li:marker:text-primary prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-img:mx-auto prose-img:w-full prose-figure:my-6 prose-strong:text-foreground prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4";
              if (contentHasImages || !gallery.length) {
                return <div className={proseClass} dangerouslySetInnerHTML={{ __html: html }} />;
              }
              const parts: string[] = html.split(/(<\/p>)/i).reduce((acc: string[], cur: string, i: number, arr: string[]) => {
                if (i % 2 === 0) acc.push(cur + (arr[i + 1] || ""));
                return acc;
              }, []).filter(s => s.trim());
              const interval = Math.max(1, Math.ceil(parts.length / (gallery.length + 1)));
              const blocks: React.JSX.Element[] = [];
              let imgIdx = 0;
              for (let i = 0; i < parts.length; i++) {
                blocks.push(<div key={`p-${i}`} className={proseClass} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(parts[i], { USE_PROFILES: { html: true } }) }} />);
                if ((i + 1) % interval === 0 && imgIdx < gallery.length) {
                  blocks.push(
                    <figure key={`img-${imgIdx}`} className="my-6">
                      <img src={gallery[imgIdx]} alt={`${title} - ${imgIdx + 1}`} className="w-full rounded-xl object-cover" loading="lazy" />
                    </figure>
                  );
                  imgIdx++;
                }
              }
              while (imgIdx < gallery.length) {
                blocks.push(
                  <figure key={`img-end-${imgIdx}`} className="my-6">
                    <img src={gallery[imgIdx]} alt={`${title} - ${imgIdx + 1}`} className="w-full rounded-xl object-cover" loading="lazy" />
                  </figure>
                );
                imgIdx++;
              }
              return <>{blocks}</>;
            })()}

            {/* Tags hidden per admin request */}

            {/* Views */}
            <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> {blog.views_count || 0} {t("views", "व्यूज")}
            </div>
          </article>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Search */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-bold text-foreground mb-3">{t("Search Post", "पोस्ट खोजें")}</h3>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t("Search", "खोजें")}
                  className="w-full px-4 py-2.5 pr-10 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  onKeyDown={e => {
                    if (e.key === "Enter" && searchQuery.trim()) {
                      window.location.href = `/blog?search=${encodeURIComponent(searchQuery.trim())}`;
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (searchQuery.trim()) window.location.href = `/blog?search=${encodeURIComponent(searchQuery.trim())}`;
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-primary-foreground rounded-md hover:opacity-80 transition">
                  <Search className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Recent Posts */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-bold text-foreground mb-4">{t("Recent Posts", "हाल की पोस्ट")}</h3>
              <div className="space-y-4">
                {filteredRecent.slice(0, 6).map(post => (
                  <Link key={post.id} to="/blog/$slug" params={{ slug: post.slug }} className="flex gap-3 group">
                    {post.image_url ? (
                      <img src={post.image_url} alt={post.title} className="w-16 h-16 rounded-lg object-cover shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-lg">📝</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition leading-snug">
                        {lang === "hi" && post.title_hi ? post.title_hi : post.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{new Date(post.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span>By {post.author || "admin"}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
};

export default BlogDetailPage;
