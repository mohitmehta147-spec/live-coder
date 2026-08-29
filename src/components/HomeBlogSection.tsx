import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "@tanstack/react-router";
import { Calendar, User, ArrowRight } from "lucide-react";

const HomeBlogSection = () => {
  const { t, lang } = useLanguage();
  const [blogs, setBlogs] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("blogs").select("*").eq("is_published", true)
      .order("created_at", { ascending: false }).limit(3)
      .then(({ data }) => setBlogs(data || []));
  }, []);

  if (blogs.length === 0) return null;

  return (
    <section className="py-10 md:py-14 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">{t("Health Tips & Blog", "स्वास्थ्य टिप्स और ब्लॉग")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("Latest Ayurvedic health articles", "नवीनतम आयुर्वेदिक स्वास्थ्य लेख")}</p>
          </div>
          <Link to="/blog" className="text-primary font-semibold text-sm hover:underline">{t("View All →", "सभी देखें →")}</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {blogs.map(blog => (
            <Link key={blog.id} to="/blog/$slug" params={{ slug: blog.slug }}
              className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition group">
              {blog.image_url ? (
                <img loading="lazy" decoding="async" src={blog.image_url} alt={blog.title} className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="h-44 bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <span className="text-4xl">📝</span>
                </div>
              )}
              <div className="p-4">
                <h3 className="font-bold text-base mb-1 line-clamp-2 group-hover:text-primary transition">
                  {lang === "hi" && blog.title_hi ? blog.title_hi : blog.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {lang === "hi" && blog.excerpt_hi ? blog.excerpt_hi : blog.excerpt}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
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
      </div>
    </section>
  );
};

export default HomeBlogSection;
