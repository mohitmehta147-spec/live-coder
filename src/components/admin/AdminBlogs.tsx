import { useEffect, useState, useRef, useMemo } from "react";
import DOMPurify from "dompurify";
import { supabase } from "@/lib/supabase";
import { trashDelete } from "@/lib/trash";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Eye, EyeOff, Save, X, RefreshCw, Upload, ImageIcon, User, Calendar } from "lucide-react";

const emptyForm = {
  title: "", title_hi: "", slug: "", content: "", content_hi: "",
  excerpt: "", excerpt_hi: "", image_url: "", category: "health",
  tags: "", meta_title: "", meta_description: "", is_published: false, author: "VedicUpchar",
};

// WordPress-style visual rich-text editor (with raw HTML toggle)
const RichEditor = ({ value, onChange, minHeight = 220 }: { value: string; onChange: (html: string) => void; minHeight?: number }) => {
  const [htmlMode, setHtmlMode] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);

  // Sync external value changes (e.g. loading a blog for edit) into the visual area
  useEffect(() => {
    if (!htmlMode && areaRef.current && value !== lastEmitted.current) {
      areaRef.current.innerHTML = value || "";
    }
  }, [value, htmlMode]);

  const exec = (cmd: string, arg?: string) => {
    areaRef.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };
  const emit = () => {
    const html = areaRef.current?.innerHTML || "";
    lastEmitted.current = html;
    onChange(html);
  };
  const insertLink = () => {
    const url = prompt("Link URL:", "https://");
    if (url) exec("createLink", url);
  };
  const insertImage = () => {
    const url = prompt("Image URL:");
    if (url) exec("insertImage", url);
  };

  const btn = "px-2 py-1 rounded-md bg-background border border-border hover:bg-primary hover:text-primary-foreground transition text-xs";

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/40 border-b border-border">
        {!htmlMode && (
          <>
            <button type="button" onClick={() => exec("formatBlock", "h2")} className={btn}>H2</button>
            <button type="button" onClick={() => exec("formatBlock", "h3")} className={btn}>H3</button>
            <button type="button" onClick={() => exec("formatBlock", "p")} className={btn}>¶</button>
            <span className="w-px h-4 bg-border mx-0.5" />
            <button type="button" onClick={() => exec("bold")} className={`${btn} font-bold`}>B</button>
            <button type="button" onClick={() => exec("italic")} className={`${btn} italic`}>I</button>
            <button type="button" onClick={() => exec("underline")} className={`${btn} underline`}>U</button>
            <span className="w-px h-4 bg-border mx-0.5" />
            <button type="button" onClick={() => exec("insertUnorderedList")} className={btn}>• List</button>
            <button type="button" onClick={() => exec("insertOrderedList")} className={btn}>1. List</button>
            <button type="button" onClick={() => exec("formatBlock", "blockquote")} className={btn}>❝ Quote</button>
            <span className="w-px h-4 bg-border mx-0.5" />
            <button type="button" onClick={insertLink} className={btn}>🔗 Link</button>
            <button type="button" onClick={insertImage} className={btn}>🖼 Image</button>
            <button type="button" onClick={() => exec("removeFormat")} className={btn}>✕ Clear</button>
          </>
        )}
        <button type="button" onClick={() => setHtmlMode(m => !m)}
          className={`ml-auto px-2 py-1 rounded-md text-xs font-medium border transition ${htmlMode ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}>
          {htmlMode ? "👁 Visual" : "</> HTML"}
        </button>
      </div>
      {htmlMode ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={12}
          className="w-full px-3 py-2 text-sm bg-background font-mono focus:outline-none" />
      ) : (
        <div
          ref={areaRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          style={{ minHeight }}
          className="w-full px-3 py-2 text-sm bg-background focus:outline-none overflow-y-auto max-h-[500px] prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-headings:font-bold prose-h2:text-xl prose-h3:text-lg prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-3 prose-img:rounded-xl"
        />
      )}
    </div>
  );
};

const WORDPRESS_BLOG_SOURCE = "https://bansalyoga.in";

const AdminBlogs = () => {
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const uploadImages = async (files: FileList | null, asMain: boolean = false) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['png','jpg','jpeg','webp','gif'].includes(ext || '')) {
        toast({ title: `${file.name} - only PNG/JPG/WEBP/GIF`, variant: "destructive" }); continue;
      }
      if (file.size > 5 * 1024 * 1024) { toast({ title: `${file.name} - max 5MB`, variant: "destructive" }); continue; }
      const fileName = `blogs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, file, { contentType: file.type });
      if (error) { toast({ title: `Upload failed: ${error.message}`, variant: "destructive" }); continue; }
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
      urls.push(urlData.publicUrl);
    }
    if (asMain && urls[0]) setForm(f => ({ ...f, image_url: urls[0] }));
    if (urls.length) setGalleryImages(prev => [...prev, ...urls]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Move ${selected.size} blog post(s) to Trash? You can restore them within 30 days.`)) return;
    const ids = Array.from(selected);
    let failed = 0;
    for (const id of ids) {
      const { error } = await trashDelete("blogs", id);
      if (error) failed++;
    }
    if (failed) toast({ title: `Moved ${ids.length - failed}, ${failed} failed`, variant: "destructive" });
    else toast({ title: `🗑️ Moved ${ids.length} post(s) to Trash` });
    setSelected(new Set());
    fetchBlogs();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const [importStatus, setImportStatus] = useState("");
  const handleWPImport = async () => {
    if (!confirm("Import all blog posts from WordPress with images mirrored to our server? Existing posts (matched by slug) will be updated. This processes in small batches and may take a few minutes.")) return;
    setImporting(true);
    setImportStatus("Starting...");
    let totalImported = 0, totalUpdated = 0, totalFailed = 0;
    let nextPage: number | null = 1;
    try {
      while (nextPage) {
        const { data, error } = await supabase.functions.invoke("wc-import-blogs", {
          body: { page: nextPage, perPage: 3, siteUrl: WORDPRESS_BLOG_SOURCE },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        totalImported += data.imported || 0;
        totalUpdated += data.updated || 0;
        totalFailed += data.failed || 0;
        setImportStatus(`${data.source || WORDPRESS_BLOG_SOURCE} · Page ${data.page}/${data.totalPages} · ${totalImported} new, ${totalUpdated} updated, ${totalFailed} failed`);
        await fetchBlogs();
        nextPage = data.nextPage ?? null;
      }
      setImportStatus("");
      toast({ title: "✅ Import complete", description: `Imported ${totalImported}, updated ${totalUpdated}, failed ${totalFailed}` });
      fetchBlogs();
    } catch (e: any) {
      setImportStatus(e.message || "Import failed");
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };
  const { toast } = useToast();

  const fetchBlogs = async () => {
    // Admins can see all blogs (including unpublished) via the admin RLS policy
    const { data } = await supabase.from("blogs").select("*").order("created_at", { ascending: false });
    setBlogs(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchBlogs(); }, []);

  const generateSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Convert plain-text content to WordPress-style HTML (paragraphs + line breaks)
  // so manually-created posts render identically to imported ones.
  const autoFormat = (raw: string): string => {
    const s = (raw || "").trim();
    if (!s) return "";
    // Already HTML? leave as-is.
    if (/<\/?(p|div|h[1-6]|ul|ol|li|figure|img|blockquote|br|table|iframe|section|article)\b/i.test(s)) {
      return s;
    }
    return s
      .split(/\n{2,}/)
      .map(block => `<p>${block.trim().replace(/\n/g, "<br />")}</p>`)
      .join("\n");
  };

  const handleSave = async () => {
    if (!form.title || !form.slug) {
      toast({ title: "Title and slug are required", variant: "destructive" });
      return;
    }

    const payload: any = {
      ...form,
      content: autoFormat(form.content),
      content_hi: autoFormat(form.content_hi),
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      images: galleryImages,
    };

    if (editing) {
      const { error } = await supabase.from("blogs").update(payload).eq("id", editing);
      if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "✅ Blog updated" });
    } else {
      const { error } = await supabase.from("blogs").insert(payload);
      if (error) { toast({ title: "Insert failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "✅ Blog created" });
    }

    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    setGalleryImages([]);
    fetchBlogs();
  };

  const startEdit = (blog: any) => {
    setEditing(blog.id);
    setForm({
      title: blog.title || "", title_hi: blog.title_hi || "", slug: blog.slug || "",
      content: blog.content || "", content_hi: blog.content_hi || "",
      excerpt: blog.excerpt || "", excerpt_hi: blog.excerpt_hi || "",
      image_url: blog.image_url || "", category: blog.category || "health",
      tags: (blog.tags || []).join(", "),
      meta_title: blog.meta_title || "", meta_description: blog.meta_description || "",
      is_published: blog.is_published || false, author: blog.author || "VedicUpchar",
    });
    setGalleryImages(Array.isArray(blog.images) ? blog.images : []);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const deleteBlog = async (id: string, title: string) => {
    if (!confirm(`Move "${title}" to Trash? You can restore it within 30 days.`)) return;
    await trashDelete("blogs", id);
    toast({ title: "🗑️ Moved to Trash" });
    fetchBlogs();
  };

  const togglePublish = async (blog: any) => {
    await supabase.from("blogs").update({ is_published: !blog.is_published }).eq("id", blog.id);
    toast({ title: blog.is_published ? "Blog unpublished" : "✅ Blog published" });
    fetchBlogs();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h2 className="text-2xl font-bold text-foreground">Blog Posts ({blogs.length})</h2>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <button onClick={bulkDelete}
              className="bg-destructive text-destructive-foreground px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90">
              <Trash2 className="h-4 w-4" /> Delete Selected ({selected.size})
            </button>
          )}
          <button onClick={handleWPImport} disabled={importing}
            className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${importing ? "animate-spin" : ""}`} /> {importing ? (importStatus || "Importing...") : "Import from WordPress"}
          </button>
          <button onClick={() => { setForm(emptyForm); setEditing(null); setGalleryImages([]); setShowForm(true); }}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90">
            <Plus className="h-4 w-4" /> New Post
          </button>
        </div>
      </div>
      {importStatus && (
        <p className="-mt-4 mb-4 text-xs font-medium text-muted-foreground break-words">{importStatus}</p>
      )}

      {showForm && (
        <div ref={formRef} className="bg-card rounded-xl border border-border p-5 mb-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">{editing ? "Edit Blog Post" : "New Blog Post"}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input placeholder="Title (English)" value={form.title} onChange={e => { setForm({...form, title: e.target.value, slug: editing ? form.slug : generateSlug(e.target.value) }); }}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <input placeholder="Title (Hindi)" value={form.title_hi} onChange={e => setForm({...form, title_hi: e.target.value})}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <input placeholder="Slug (URL)" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <input placeholder="Category" value={form.category} onChange={e => setForm({...form, category: e.target.value})}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </div>

          {/* Featured Image Upload */}
          <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> Featured Image</p>
            {form.image_url && (
              <div className="relative inline-block">
                <img loading="lazy" decoding="async" src={form.image_url} alt="" className="w-32 h-20 object-cover rounded-lg" />
                <button type="button" onClick={() => setForm({ ...form, image_url: "" })}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="h-3 w-3" /></button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="cursor-pointer flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90">
                <Upload className="h-3.5 w-3.5" /> {form.image_url ? "Replace" : "Upload"}
                <input type="file" accept="image/*" className="hidden" onChange={e => uploadImages(e.target.files, true)} />
              </label>
              <input placeholder="…or paste URL" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})}
                className="flex-1 px-3 py-1.5 border border-border rounded-lg text-xs bg-background" />
            </div>
          </div>

          {/* Gallery Images Upload */}
          <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> Additional Images (Gallery)</p>
            {galleryImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {galleryImages.map((url, i) => (
                  <div key={i} className="relative">
                    <img loading="lazy" decoding="async" src={url} alt="" className="w-20 h-16 object-cover rounded-lg border border-border" />
                    <button type="button" onClick={() => setGalleryImages(p => p.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-xs font-medium hover:opacity-90">
              <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading..." : "Upload Multiple"}
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => uploadImages(e.target.files, false)} />
            </label>
          </div>

          <div className="space-y-3">
            <textarea placeholder="Excerpt (short description)" value={form.excerpt} onChange={e => setForm({...form, excerpt: e.target.value})}
              rows={2} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <textarea placeholder="Excerpt Hindi" value={form.excerpt_hi} onChange={e => setForm({...form, excerpt_hi: e.target.value})}
              rows={2} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />

            {/* Formatting toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 border border-border rounded-lg bg-muted/40 text-xs">
              <span className="text-muted-foreground mr-1">Insert:</span>
              {[
                { label: "H2", ins: "<h2>Heading</h2>\n\n" },
                { label: "H3", ins: "<h3>Sub-heading</h3>\n\n" },
                { label: "Paragraph", ins: "<p>Your text here...</p>\n\n" },
                { label: "Bold", ins: "<strong>bold text</strong>" },
                { label: "List", ins: "<ul>\n  <li>Item 1</li>\n  <li>Item 2</li>\n</ul>\n\n" },
                { label: "Quote", ins: "<blockquote>Quote text</blockquote>\n\n" },
                { label: "Link", ins: '<a href="https://">link text</a>' },
                { label: "Image", ins: '<img src="IMAGE_URL" alt="" />\n\n' },
              ].map(b => (
                <button key={b.label} type="button" onClick={() => setForm(f => ({ ...f, content: (f.content || "") + b.ins }))}
                  className="px-2 py-1 rounded-md bg-background border border-border hover:bg-primary hover:text-primary-foreground transition">
                  {b.label}
                </button>
              ))}
            </div>

            <textarea placeholder="Content (HTML supported — write like WordPress: use <h2>, <p>, <ul>, <img> etc.)" value={form.content} onChange={e => setForm({...form, content: e.target.value})}
              rows={12} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background font-mono" />

            {/* Live Preview (matches BlogDetailPage rendering) */}
            {form.content && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between bg-muted/50 px-3 py-2 border-b border-border">
                  <span className="text-xs font-semibold flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> Live Preview (English)</span>
                  <span className="text-[10px] text-muted-foreground">Same layout as published blog</span>
                </div>
                <div className="p-4 bg-background max-h-[500px] overflow-y-auto">
                  <h1 className="text-2xl font-bold text-foreground mb-3 leading-tight">{form.title || "Your blog title"}</h1>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-4 pb-3 border-b border-border">
                    <span className="flex items-center gap-1.5"><User className="h-3 w-3" /> {form.author || "admin"}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    {form.category && <span>Categories: <span className="text-primary font-medium">{form.category}</span></span>}
                  </div>
                  {form.image_url && (
                    <img loading="lazy" decoding="async" src={form.image_url} alt="" className="w-full rounded-xl mb-4 object-cover max-h-[300px]" />
                  )}
                  <div
                    className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-headings:font-bold prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2 prose-p:leading-relaxed prose-p:mb-3 prose-li:marker:text-primary prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-3 prose-img:rounded-xl prose-img:mx-auto prose-img:w-full"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(autoFormat(form.content), { USE_PROFILES: { html: true } }) }}
                  />
                </div>
              </div>
            )}

            <textarea placeholder="Content Hindi (HTML supported)" value={form.content_hi} onChange={e => setForm({...form, content_hi: e.target.value})}
              rows={8} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background font-mono" />
          </div>


          <div className="border-t border-border pt-4 space-y-3">
            <h4 className="font-semibold text-sm">SEO Settings</h4>
            <input placeholder="Meta Title (SEO)" value={form.meta_title} onChange={e => setForm({...form, meta_title: e.target.value})}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <textarea placeholder="Meta Description (SEO)" value={form.meta_description} onChange={e => setForm({...form, meta_description: e.target.value})}
              rows={2} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <input placeholder="Tags (comma separated)" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <input placeholder="Author" value={form.author} onChange={e => setForm({...form, author: e.target.value})}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_published} onChange={e => setForm({...form, is_published: e.target.checked})}
                className="rounded" />
              Publish immediately
            </label>
            <button onClick={handleSave}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90">
              <Save className="h-4 w-4" /> {editing ? "Update" : "Create"} Post
            </button>
          </div>
        </div>
      )}

      {loading ? <p className="text-muted-foreground">Loading...</p> :
        blogs.length === 0 ? <p className="text-muted-foreground">No blog posts yet. Create your first post!</p> :
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <input type="checkbox" checked={selected.size === blogs.length && blogs.length > 0}
              onChange={e => setSelected(e.target.checked ? new Set(blogs.map(b => b.id)) : new Set())} />
            Select All
          </label>
          {blogs.map((blog, idx) => (
            <div key={blog.id} className={`bg-card rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${selected.has(blog.id) ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <input type="checkbox" checked={selected.has(blog.id)} onChange={() => toggleSelect(blog.id)} className="shrink-0" />
                <span className="shrink-0 inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded-md bg-muted text-[10px] font-bold text-muted-foreground border border-border">#{idx + 1}</span>
                {blog.image_url ? (
                  <img loading="lazy" decoding="async" src={blog.image_url} alt="" className="w-16 h-12 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-16 h-12 bg-muted rounded-lg flex items-center justify-center shrink-0">📝</div>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{blog.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`px-1.5 py-0.5 rounded-full ${blog.is_published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {blog.is_published ? "Published" : "Draft"}
                    </span>
                    <span>{blog.category}</span>
                    <span>{blog.views_count || 0} views</span>
                    <span>{new Date(blog.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={`/blog/${blog.slug}`} target="_blank" rel="noopener noreferrer"
                  className="p-2 hover:bg-muted rounded-lg" title="View on site">
                  <Eye className="h-4 w-4 text-emerald-600" />
                </a>
                <button onClick={() => togglePublish(blog)} className="p-2 hover:bg-muted rounded-lg" title={blog.is_published ? "Unpublish" : "Publish"}>
                  {blog.is_published ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-primary" />}
                </button>
                <button onClick={() => startEdit(blog)} className="p-2 hover:bg-muted rounded-lg"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                <button onClick={() => deleteBlog(blog.id, blog.title)} className="p-2 hover:bg-destructive/10 rounded-lg"><Trash2 className="h-4 w-4 text-destructive" /></button>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
};

export default AdminBlogs;
