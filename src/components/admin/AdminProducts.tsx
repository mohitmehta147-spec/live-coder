import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import { supabase } from "@/lib/supabase";
import { withPackInfoAll, formatPackSize } from "@/lib/packs";
import { compressImage, imageLoads } from "@/lib/imageCompress";
import { trashDelete } from "@/lib/trash";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, X, Image as ImageIcon, Search, Download, Filter, RefreshCw, Save, Check, FileSpreadsheet, ExternalLink, Copy } from "lucide-react";

type Product = {
  id: string; name: string; name_hi: string | null; price: number; mrp: number;
  stock: number; is_active: boolean | null; badge: string | null; slug: string;
  category_id: string | null; description: string | null; description_hi: string | null;
  image_url: string | null; images: string[] | null; sku: string | null;
  rating: number | null; reviews_count: number | null; sizes: string[] | null;
  features: any[]; tags: string[] | null; meta_title: string | null; meta_description: string | null;
};

type Category = { id: string; name: string; parent_id: string | null };

const defaultFeatures = [
  { icon: "🌿", text: "100% Herbal" },
  { icon: "✅", text: "Clinically Proven" },
  { icon: "🚚", text: "Free Delivery" },
  { icon: "🔬", text: "Lab Tested" },
];

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  // Extra categories (a product can live in several categories at once)
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Inline-edit row state: per-row dirty values + saving flag
  const [rowEdits, setRowEdits] = useState<Record<string, { name?: string; mrp?: string; price?: string; stock?: string; is_active?: boolean; badge?: string; rating?: string; reviews_count?: string }>>({});
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [excelImporting, setExcelImporting] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEdit, setBulkEdit] = useState<{ price: string; mrp: string; stock: string; badge: string; is_active: string; category_id: string; discount_pct: string }>({ price: "", mrp: "", stock: "", badge: "", is_active: "", category_id: "", discount_pct: "" });
  const [bulkSaving, setBulkSaving] = useState(false);
  const { toast } = useToast();

  const runBulkEdit = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const patch: any = {};
    if (bulkEdit['price'] !== "") patch['price'] = parseFloat(bulkEdit['price']) || 0;
    if (bulkEdit['mrp'] !== "") patch['mrp'] = parseFloat(bulkEdit['mrp']) || 0;
    if (bulkEdit.stock !== "") patch.stock = parseInt(bulkEdit.stock) || 0;
    if (bulkEdit.badge !== "") patch.badge = bulkEdit.badge === "__clear__" ? null : bulkEdit.badge;
    if (bulkEdit.is_active !== "") patch.is_active = bulkEdit.is_active === "true";
    if (bulkEdit['category_id'] !== "") patch['category_id'] = bulkEdit['category_id'];
    const pct = parseFloat(bulkEdit.discount_pct);
    const hasPct = !isNaN(pct) && pct > 0;
    if (Object.keys(patch).length === 0 && !hasPct) { toast({ title: "Koi field fill karein", variant: "destructive" }); return; }
    if (!confirm(`Apply changes to ${ids.length} product(s)?`)) return;
    setBulkSaving(true);
    let ok = 0, fail = 0;
    if (hasPct) {
      // Per-row price calc from current MRP
      for (const id of ids) {
        const p = products.find(x => x.id === id); if (!p) { fail++; continue; }
        const rowPatch = { ...patch, price: Math.round((p['mrp'] || 0) * (1 - pct / 100)) };
        const { error } = await supabase.from("products").update(rowPatch).eq("id", id);
        if (error) fail++; else { ok++; setProducts(prev => prev.map(x => x.id === id ? { ...x, ...rowPatch } : x)); }
      }
    } else {
      const { error } = await supabase.from("products").update(patch).in("id", ids);
      if (error) fail = ids.length; else {
        ok = ids.length;
        setProducts(prev => prev.map(x => ids.includes(x.id) ? { ...x, ...patch } : x));
      }
    }
    setBulkSaving(false);
    setShowBulkEdit(false);
    setBulkEdit({ price: "", mrp: "", stock: "", badge: "", is_active: "", category_id: "", discount_pct: "" });
    setSelected(new Set());
    toast({ title: `✅ Updated ${ok}${fail ? ` • Failed ${fail}` : ""}` });
  };

  const [form, setForm] = useState({
    name: "", name_hi: "", price: "", mrp: "", stock: "",
    badge: "", slug: "", description: "", description_hi: "",
    sku: "", is_active: true, category_id: "", rating: "", reviews_count: "",
    sizes: "", tags: "", meta_title: "", meta_description: "",
    sale_price: "", sale_starts_at: "", sale_ends_at: "",
    banner_image: "", banner_image_mobile: "", banner_video_url: "", benefits_banner: "", benefits_banner_mobile: "", ingredients_banner: "", ingredients_banner_mobile: "", how_to_use: "", product_type: "", unit: "", base_pack_size: "",
    variation_label: "", variation_display: "card",
  });

  const BUILTIN_PRODUCT_TYPES = ["Churna","Tablet","Avaleha","Tailam","Capsule","Kwath","Syrup","Resin","Beverages","Cream"];
  const [customTypes, setCustomTypes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("vu_product_types") || "[]"); } catch { return []; }
  });
  const saveCustomTypes = (arr: string[]) => {
    setCustomTypes(arr);
    localStorage.setItem("vu_product_types", JSON.stringify(arr));
  };
  const addCustomType = (val: string) => {
    const v = val.trim();
    if (!v) return;
    if (BUILTIN_PRODUCT_TYPES.includes(v) || customTypes.includes(v)) return;
    saveCustomTypes([...customTypes, v]);
  };
  const removeCustomType = (val: string) => {
    saveCustomTypes(customTypes.filter(t => t !== val));
    if (form.product_type === val) setForm(f => ({ ...f, product_type: "" }));
  };

  const [features, setFeatures] = useState<{ icon: string; text: string }[]>([]);
  const [newFeature, setNewFeature] = useState({ icon: "🌿", text: "" });
  const [benefits, setBenefits] = useState<{ icon: string; title: string; description: string }[]>([]);
  const [ingredients, setIngredients] = useState<{ icon: string; name: string; description: string }[]>([]);
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>([]);
  const [variations, setVariations] = useState<{ label: string; mrp: number; price: number; image?: string; tagline?: string }[]>([]);


  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts((data as any) || []);
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("id, name, parent_id").order("sort_order");
    setCategories(data || []);
  };

  useEffect(() => { fetchProducts(); fetchCategories(); }, []);

  const filteredProducts = useMemo(() => products.filter((p) => {
    if (filterStatus === "active" && !p.is_active) return false;
    if (filterStatus === "inactive" && p.is_active !== false) return false;
    if (filterCategory !== "all" && p['category_id'] !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const searchable = [p.name, p.name_hi, p.sku, p.id, p.slug].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(q);
    }
    return true;
  }), [products, filterStatus, filterCategory, searchQuery]);

  const resetForm = () => {
    setForm({ name: "", name_hi: "", price: "", mrp: "", stock: "", badge: "", slug: "", description: "", description_hi: "", sku: "", is_active: true, category_id: "", rating: "", reviews_count: "", sizes: "", tags: "", meta_title: "", meta_description: "", sale_price: "", sale_starts_at: "", sale_ends_at: "", banner_image: "", banner_image_mobile: "", banner_video_url: "", benefits_banner: "", benefits_banner_mobile: "", ingredients_banner: "", ingredients_banner_mobile: "", how_to_use: "", product_type: "", unit: "", base_pack_size: "", variation_label: "", variation_display: "card" });
    setUploadedImages([]); setExtraCategories([]);
    setFeatures([]);
    setBenefits([]);
    setIngredients([]);
    setFaqs([]);
    setVariations([]);
    setEditing(null);
    setShowForm(false);
  };


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) { toast({ title: `${file.name} - Only PNG, JPG, JPEG, WEBP allowed`, variant: "destructive" }); continue; }
      if (file.size > 5 * 1024 * 1024) { toast({ title: `${file.name} - Max 5MB allowed`, variant: "destructive" }); continue; }
      const prepared = await compressImage(file);
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${prepared.ext}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, prepared.blob, { contentType: prepared.contentType });
      if (!error) {
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
        const ok = await imageLoads(urlData.publicUrl);
        if (!ok) { toast({ title: `${file.name} - image could not be read, please re-upload`, variant: "destructive" }); continue; }
        newUrls.push(urlData.publicUrl);
      } else { toast({ title: `Upload failed: ${error.message}`, variant: "destructive" }); }
    }
    setUploadedImages(prev => {
      const next = [...prev];
      if (uploadTargetIdx !== null && newUrls.length > 0) {
        // Fill targeted slot first, then keep going forward into other empty slots
        let cursor = uploadTargetIdx;
        for (const url of newUrls) {
          while (next.length <= cursor) next.push("");
          next[cursor] = url;
          cursor++;
        }
      } else {
        // Append into first empty trailing slots / end
        for (const url of newUrls) {
          const emptyIdx = next.findIndex(u => !u);
          if (emptyIdx >= 0) next[emptyIdx] = url;
          else next.push(url);
        }
      }
      return next;
    });
    setUploadTargetIdx(null);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadFilesToBucket = async (files: FileList | null) => {
    if (!files || files.length === 0) return [] as string[];
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) { toast({ title: `${file.name} - Only PNG, JPG, JPEG, WEBP allowed`, variant: "destructive" }); continue; }
      if (file.size > 5 * 1024 * 1024) { toast({ title: `${file.name} - Max 5MB allowed`, variant: "destructive" }); continue; }
      const prepared = await compressImage(file);
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${prepared.ext}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, prepared.blob, { contentType: prepared.contentType });
      if (!error) {
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
        const ok = await imageLoads(urlData.publicUrl);
        if (!ok) { toast({ title: `${file.name} - image could not be read, please re-upload`, variant: "destructive" }); continue; }
        newUrls.push(urlData.publicUrl);
      } else {
        toast({ title: `Upload failed: ${error.message}`, variant: "destructive" });
      }
    }
    setUploading(false);
    return newUrls;
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const [url] = await uploadFilesToBucket(e.target.files);
    if (url) setForm(prev => ({ ...prev, banner_image: url }));
    e.target.value = "";
  };

  const handleSectionBannerUpload = async (field: "benefits_banner" | "benefits_banner_mobile" | "ingredients_banner" | "ingredients_banner_mobile" | "banner_image_mobile", e: React.ChangeEvent<HTMLInputElement>) => {
    const [url] = await uploadFilesToBucket(e.target.files);
    if (url) setForm(prev => ({ ...prev, [field]: url }));
    e.target.value = "";
  };

  const handleStructuredImageUpload = async (type: "benefit" | "ingredient", index: number, files: FileList | null) => {
    const [url] = await uploadFilesToBucket(files);
    if (!url) return;
    if (type === "benefit") {
      setBenefits(arr => arr.map((item, idx) => idx === index ? { ...item, image: url } : item));
      return;
    }
    setIngredients(arr => arr.map((item, idx) => idx === index ? { ...item, image: url } : item));
  };

  const removeImage = (idx: number) => setUploadedImages(prev => {
    // Keep the slot empty instead of shifting other images
    const next = [...prev];
    next[idx] = "";
    while (next.length > 0 && !next[next.length - 1]) next.pop();
    return next;
  });
  const moveImage = (idx: number, dir: -1 | 1) => setUploadedImages(prev => {
    const next = [...prev];
    const j = idx + dir;
    if (j < 0 || j >= Math.max(next.length, 10)) return prev;
    while (next.length <= Math.max(idx, j)) next.push("");
    [next[idx], next[j]] = [next[j], next[idx]];
    while (next.length > 0 && !next[next.length - 1]) next.pop();
    return next;
  });
  const [uploadTargetIdx, setUploadTargetIdx] = useState<number | null>(null);

  const addFeature = () => {
    if (!newFeature.text.trim()) return;
    setFeatures(prev => [...prev, { ...newFeature }]);
    setNewFeature({ icon: "🌿", text: "" });
  };

  const removeFeature = (idx: number) => setFeatures(prev => prev.filter((_, i) => i !== idx));

  const addDefaultFeatures = () => {
    setFeatures(prev => [...prev, ...defaultFeatures.filter(df => !prev.some(f => f.text === df.text))]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Product name is required", variant: "destructive" }); return; }
    const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    const sizesArr = form.sizes ? form.sizes.split(",").map(s => s.trim()).filter(Boolean) : [];
    const tagsArr = form.tags ? form.tags.split(",").map(s => s.trim()).filter(Boolean) : [];
    const payload: any = {
      name: form.name, name_hi: form.name_hi || null,
      price: parseFloat(form['price']) || 0, mrp: parseFloat(form['mrp']) || 0,
      stock: parseInt(form.stock) || 0, badge: form.badge || null, slug,
      description: form.description || null, description_hi: form.description_hi || null,
      sku: form.sku || null, image_url: uploadedImages.find(Boolean) || null,
      images: uploadedImages.filter(Boolean).length > 0 ? uploadedImages.filter(Boolean) : null,
      is_active: form.is_active, category_id: form['category_id'] || null,
      category_ids: Array.from(new Set([form['category_id'], ...extraCategories].filter(Boolean))),
      rating: parseFloat(form.rating) || 0, reviews_count: parseInt(form.reviews_count) || 0,
      sizes: sizesArr.length > 0 ? sizesArr : [],
      features: features,
      tags: tagsArr.length > 0 ? tagsArr : [],
      meta_title: form.meta_title || null,
      meta_description: form.meta_description || null,
      sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
      sale_starts_at: form.sale_starts_at ? new Date(form.sale_starts_at).toISOString() : null,
      sale_ends_at: form.sale_ends_at ? new Date(form.sale_ends_at).toISOString() : null,
      banner_image: form.banner_image || null,
      banner_image_mobile: form.banner_image_mobile || null,
      banner_video_url: form.banner_video_url || null,
      benefits_banner: form.benefits_banner || null,
      benefits_banner_mobile: form.benefits_banner_mobile || null,
      ingredients_banner: form.ingredients_banner || null,
      ingredients_banner_mobile: form.ingredients_banner_mobile || null,
      how_to_use: form.how_to_use || null,
      benefits: benefits,
      ingredients: ingredients,
      faqs: faqs,
      product_type: form.product_type || null,
      unit: form.unit || null,
      base_pack_size: form.base_pack_size ? parseFloat(form.base_pack_size) : null,
      variations: variations,
      variation_label: form.variation_label || null,
      variation_display: form.variation_display || "card",
    };


    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "✅ Product updated successfully!" });
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) { toast({ title: "Add failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "✅ Product added successfully!" });
    }
    resetForm();
    fetchProducts();
  };

  const handleEdit = (p: Product) => {
    setEditing(p);
    const pAny = p as any;
    setForm({
      name: p.name, name_hi: p.name_hi || "", price: String(p['price']), mrp: String(p['mrp']),
      stock: String(p.stock), badge: p.badge || "", slug: p.slug, description: p.description || "",
      description_hi: p.description_hi || "", sku: p.sku || "",
      is_active: p.is_active !== false, category_id: p['category_id'] || "",
      rating: String(p.rating || ""), reviews_count: String(p.reviews_count || ""),
      sizes: (p.sizes || []).join(", "),
      tags: (p.tags || []).join(", "),
      meta_title: p.meta_title || "",
      meta_description: p.meta_description || "",
      sale_price: pAny.sale_price ? String(pAny.sale_price) : "",
      sale_starts_at: pAny.sale_starts_at ? new Date(pAny.sale_starts_at).toISOString().slice(0,16) : "",
      sale_ends_at: pAny.sale_ends_at ? new Date(pAny.sale_ends_at).toISOString().slice(0,16) : "",
      banner_image: pAny.banner_image || "",
      banner_image_mobile: pAny.banner_image_mobile || "",
      banner_video_url: pAny.banner_video_url || "",
      benefits_banner: pAny.benefits_banner || "",
      benefits_banner_mobile: pAny.benefits_banner_mobile || "",
      ingredients_banner: pAny.ingredients_banner || "",
      ingredients_banner_mobile: pAny.ingredients_banner_mobile || "",
      how_to_use: pAny.how_to_use || "",
      product_type: pAny.product_type || "",
      unit: pAny.unit || "",
      base_pack_size: pAny.base_pack_size != null ? String(pAny.base_pack_size) : "",
      variation_label: pAny.variation_label || "",
      variation_display: pAny.variation_display || "card",
    });
    setUploadedImages(p.images || (p.image_url ? [p.image_url] : []));
    setExtraCategories(((): string[] => {
      const raw = (pAny['category_ids'] ?? []) as any;
      const list: string[] = Array.isArray(raw) ? raw : (() => { try { return JSON.parse(raw || "[]"); } catch { return []; } })();
      return list.filter((c: string) => c && c !== p['category_id']);
    })());
    setFeatures(Array.isArray(p.features) ? p.features : []);
    setBenefits(Array.isArray(pAny.benefits) ? pAny.benefits : []);
    setIngredients(Array.isArray(pAny.ingredients) ? pAny.ingredients : []);
    setFaqs(Array.isArray(pAny.faqs) ? pAny.faqs : []);
    setVariations(Array.isArray(pAny['variations']) ? pAny['variations'] : []);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Move "${name}" to Trash? You can restore it within 30 days.`)) {
      const { error } = await trashDelete("products", id, { label: name });
      if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "🗑️ Moved to Trash" });
      fetchProducts();
    }
  };

  const handleDuplicate = async (id: string) => {
    const { data: src, error: fetchErr } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    if (fetchErr || !src) { toast({ title: "Duplicate failed", description: fetchErr?.message || "Product not found", variant: "destructive" }); return; }
    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = src as any;
    const baseSlug = (src as any).slug || (src as any).name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "") || "product";
    // Find a unique slug
    let newSlug = `${baseSlug}-copy`;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: exists } = await supabase.from("products").select("id").eq("slug", newSlug).maybeSingle();
      if (!exists) break;
      n++;
      newSlug = `${baseSlug}-copy-${n}`;
    }
    const payload = {
      ...rest,
      name: `${(src as any).name} (Copy)`,
      slug: newSlug,
      sku: (src as any).sku ? `${(src as any).sku}-COPY` : null,
      is_active: false,
    };
    const { error } = await supabase.from("products").insert(payload);
    if (error) { toast({ title: "Duplicate failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✅ Product duplicated (saved as inactive draft)" });
    fetchProducts();
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Move ${selected.size} product(s) to Trash?`)) return;
    const ids = Array.from(selected);
    let failed = 0;
    for (const id of ids) { const { error } = await trashDelete("products", id); if (error) failed++; }
    if (failed) toast({ title: `Moved ${ids.length - failed}, ${failed} failed`, variant: "destructive" });
    else toast({ title: `🗑️ Moved ${ids.length} product(s) to Trash` });
    setSelected(new Set());
    fetchProducts();
  };

  const toggleSel = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const getCategoryOptions = () => {
    const parentCategories = categories.filter(c => !c.parent_id);
    const options: { id: string; label: string; isChild: boolean }[] = [];
    parentCategories.forEach(parent => {
      options.push({ id: parent.id, label: `📁 MAIN: ${parent.name}`, isChild: false });
      categories.filter(c => c.parent_id === parent.id).forEach(child => {
        options.push({ id: child.id, label: `\u00A0\u00A0\u00A0↳ SUB: ${child.name}  (under ${parent.name})`, isChild: true });
      });
    });
    // Orphan sub-categories whose parent is missing/inactive
    categories
      .filter(c => c.parent_id && !parentCategories.some(p => p.id === c.parent_id))
      .forEach(c => options.push({ id: c.id, label: `↳ SUB: ${c.name}`, isChild: true }));
    return options;
  };

  const handleExcelDownload = () => {
    const headers = ["Name", "Name (Hindi)", "Price", "MRP", "Stock", "SKU", "Badge", "Rating", "Active", "Tags", "Meta Title"];
    const rows = products.map(p => [
      p.name, p.name_hi || "", p['price'], p['mrp'], p.stock, p.sku || "", p.badge || "",
      p.rating || 0, p.is_active ? "Yes" : "No", (p.tags || []).join("; "), p.meta_title || ""
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `products-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: "✅ Products exported!" });
  };

  const insertSampleProducts = async () => {
    const samples = [
      { name: "Ashwagandha Capsules", name_hi: "अश्वगंधा कैप्सूल", slug: "ashwagandha-capsules", description: "Pure Ashwagandha root extract capsules.", price: 399, mrp: 699, stock: 150, badge: "Bestseller", rating: 4.7, reviews_count: 2840, sku: "VU-ASH-001", is_active: true, sizes: ["60 Capsules", "120 Capsules"], features: defaultFeatures, tags: ["ashwagandha", "stress relief", "immunity"] },
      { name: "Triphala Churna", name_hi: "त्रिफला चूर्ण", slug: "triphala-churna-powder", description: "Traditional Triphala Churna for digestive health.", price: 249, mrp: 450, stock: 200, badge: "New", rating: 4.5, reviews_count: 1560, sku: "VU-TRI-001", is_active: true, sizes: ["100g", "200g"], features: defaultFeatures, tags: ["triphala", "digestion"] },
      { name: "Brahmi Hair Oil", name_hi: "ब्राह्मी हेयर ऑयल", slug: "brahmi-hair-oil", description: "Ayurvedic Brahmi hair oil.", price: 349, mrp: 599, stock: 120, badge: "Popular", rating: 4.6, reviews_count: 980, sku: "VU-BHO-001", is_active: true, sizes: ["100ml", "200ml"], features: defaultFeatures, tags: ["hair oil", "brahmi"] },
    ];
    for (const product of samples) {
      await supabase.from("products").upsert(product, { onConflict: "slug" });
    }
    toast({ title: "✅ Sample products inserted!" });
    fetchProducts();
  };

  const [wpImporting, setWpImporting] = useState(false);
  const handleWPImport = async () => {
    if (!confirm("Import all products from WordPress? Existing products with same slug will be updated. This may take a few minutes.")) return;
    setWpImporting(true);
    let totalImported = 0, totalUpdated = 0, totalFailed = 0;
    let page = 1;
    let safety = 0;
    try {
      while (safety++ < 100) {
        const { data, error } = await supabase.functions.invoke("wc-import-products", {
          body: { startPage: page, maxPages: 2, skipCategories: page > 1 },
        });
        if (error) throw error;
        const r = data as any;
        if (r?.error) throw new Error(r.error);
        totalImported += r.imported || 0;
        totalUpdated += r.updated || 0;
        totalFailed += r.failed || 0;
        toast({ title: `Importing… page ${page}`, description: `So far: +${totalImported} new, ${totalUpdated} updated${r.totalPages ? ` (of ~${r.totalPages} pages)` : ""}` });
        if (r.done || !r.nextPage) break;
        page = r.nextPage;
      }
      toast({ title: "✅ Import complete", description: `Imported: ${totalImported}, Updated: ${totalUpdated}, Failed: ${totalFailed}` });
      fetchProducts();
      fetchCategories();
    } catch (e: any) {
      toast({ title: "❌ Import failed", description: `${e.message} (stopped at page ${page})`, variant: "destructive" });
    } finally {
      setWpImporting(false);
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setExcelImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
      if (!rows.length) { toast({ title: "Empty file", variant: "destructive" }); return; }
      const slugify = (s: string) => s.toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const pick = (r: any, ...keys: string[]) => { for (const k of keys) { if (r[k] !== undefined && r[k] !== null && r[k] !== "") return r[k]; } return null; };
      const toBool = (v: any) => { if (v === null || v === undefined || v === "") return true; const s = String(v).toLowerCase(); return s === "yes" || s === "y" || s === "true" || s === "1" || s === "active"; };
      let ins = 0, upd = 0, failed = 0;
      for (const r of rows) {
        try {
          const name = pick(r, "Name", "name", "Product Name", "product_name");
          if (!name) { failed++; continue; }
          const slugRaw = pick(r, "Slug", "slug") || name;
          const slug = slugify(slugRaw);
          const tagsRaw = pick(r, "Tags", "tags");
          const tags = typeof tagsRaw === "string" ? tagsRaw.split(/[;,]/).map((s: string) => s.trim()).filter(Boolean) : null;
          const payload: any = {
            name,
            name_hi: pick(r, "Name (Hindi)", "name_hi", "Name Hindi") || null,
            slug,
            price: parseFloat(pick(r, "Price", "price", "Selling Price") ?? 0) || 0,
            mrp: parseFloat(pick(r, "MRP", "mrp") ?? 0) || 0,
            stock: parseInt(pick(r, "Stock", "stock", "Qty", "Quantity") ?? 0) || 0,
            sku: pick(r, "SKU", "sku") || null,
            badge: pick(r, "Badge", "badge") || null,
            rating: parseFloat(pick(r, "Rating", "rating") ?? 0) || 0,
            reviews_count: parseInt(pick(r, "Reviews Count", "reviews_count", "Reviews") ?? 0) || 0,
            is_active: toBool(pick(r, "Active", "is_active", "Status")),
            tags,
            meta_title: pick(r, "Meta Title", "meta_title") || null,
            meta_description: pick(r, "Meta Description", "meta_description") || null,
            description: pick(r, "Description", "description") || null,
            image_url: pick(r, "Image", "image_url", "Image URL") || null,
          };
          const { data: existing } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
          if (existing) {
            const { error } = await supabase.from("products").update(payload).eq("id", existing.id);
            if (error) failed++; else upd++;
          } else {
            const { error } = await supabase.from("products").insert(payload);
            if (error) failed++; else ins++;
          }
        } catch { failed++; }
      }
      toast({ title: "✅ Excel processed", description: `New: ${ins} • Updated: ${upd} • Failed: ${failed}` });
      fetchProducts();
    } catch (err: any) {
      toast({ title: "Excel import failed", description: err.message, variant: "destructive" });
    } finally {
      setExcelImporting(false);
    }
  };

  return (
    <div>
      <div className="admin-page-sticky">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Products ({filteredProducts.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => { if (showForm) { resetForm(); } else { setShowForm(true); setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); } }}
              className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
              {showForm ? <><X className="h-3.5 w-3.5" /> Close Form</> : <><Plus className="h-3.5 w-3.5" /> Add Product</>}
            </button>
            <button onClick={insertSampleProducts} className="flex items-center gap-1 bg-cta text-cta-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
              <Plus className="h-3.5 w-3.5" /> Samples
            </button>
            <button onClick={handleWPImport} disabled={wpImporting} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${wpImporting ? 'animate-spin' : ''}`} /> {wpImporting ? "Importing..." : "Import WP"}
            </button>
            <button onClick={() => excelInputRef.current?.click()} disabled={excelImporting} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-60">
              <FileSpreadsheet className="h-3.5 w-3.5" /> {excelImporting ? "Importing..." : "Import Excel"}
            </button>
            <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />
            {Object.keys(rowEdits).length > 0 && (
              <button onClick={async () => {
                const ids = Object.keys(rowEdits);
                if (!ids.length) return;
                if (!confirm(`Save changes to ${ids.length} product(s)?`)) return;
                let ok = 0, fail = 0;
                for (const id of ids) {
                  const p = products.find(x => x.id === id); if (!p) continue;
                  const e = rowEdits[id] || {};
                  const payload: any = {
                    name: (e.name ?? p.name).trim() || p.name,
                    mrp: parseFloat(e['mrp'] ?? String(p['mrp'])) || 0,
                    price: parseFloat(e['price'] ?? String(p['price'])) || 0,
                    stock: parseInt(e.stock ?? String(p.stock)) || 0,
                    badge: (e.badge ?? p.badge ?? "") ? String(e.badge ?? p.badge).trim() : null,
                    rating: parseFloat(e.rating ?? String(p.rating ?? 0)) || 0,
                    reviews_count: parseInt(e.reviews_count ?? String(p.reviews_count ?? 0)) || 0,
                    is_active: e.is_active ?? (p.is_active !== false),
                  };
                  const { error } = await supabase.from("products").update(payload).eq("id", id);
                  if (error) fail++; else { ok++; setProducts(prev => prev.map(x => x.id === id ? { ...x, ...payload } : x)); }
                }
                setRowEdits({});
                toast({ title: `✅ Saved ${ok}${fail ? ` • Failed ${fail}` : ""}` });
              }} className="flex items-center gap-1 bg-cta text-cta-foreground px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 animate-pulse">
                <Save className="h-3.5 w-3.5" /> Save All ({Object.keys(rowEdits).length})
              </button>
            )}
            {selected.size > 0 && (
              <>
                <button onClick={() => setShowBulkEdit(true)} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
                  <Pencil className="h-3.5 w-3.5" /> Bulk Edit ({selected.size})
                </button>
                <button onClick={bulkDelete} className="flex items-center gap-1 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
                  <Trash2 className="h-3.5 w-3.5" /> Delete ({selected.size})
                </button>
              </>
            )}
            <button
              onClick={() => {
                if (selected.size === 0) {
                  toast({ title: "Pehle products tick karein", description: "Bulk update sirf selected products par chalega.", variant: "destructive" });
                  return;
                }
                setShowBulkEdit(true);
              }}
              className="flex items-center gap-1 bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
              <Pencil className="h-3.5 w-3.5" /> Update Selected ({selected.size})
            </button>
            <button onClick={handleExcelDownload} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-3 mb-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input placeholder="Search product name, SKU, ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border transition ${showFilters ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground hover:bg-secondary'}`}>
              <Filter className="h-3.5 w-3.5" /> Filters
            </button>
          </div>
          {searchQuery && (
            <p className="text-xs text-muted-foreground">Showing {filteredProducts.length} result(s) for “{searchQuery}”</p>
          )}
        </div>

        {showFilters && (
          <div className="bg-card rounded-xl border border-border p-3 mb-0 flex flex-wrap gap-2 items-center">
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background">
              <option value="all">All Categories</option>
              {getCategoryOptions().map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {(filterCategory !== "all" || filterStatus !== "all" || searchQuery) && (
              <button onClick={() => { setFilterCategory("all"); setFilterStatus("all"); setSearchQuery(""); }} className="text-xs text-destructive hover:underline flex items-center gap-1">
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {showForm && (
      <div ref={formRef} className="bg-card rounded-xl border border-border p-4 sm:p-5 mb-6 mt-6">
        {/* Sticky action bar — Update / Cancel / Active always reachable */}
        <div className="sticky top-0 z-30 -mx-4 sm:-mx-5 -mt-4 sm:-mt-5 mb-4 px-4 sm:px-5 py-3 bg-card/95 backdrop-blur border-b border-border flex items-center justify-between gap-3 rounded-t-xl">
          <h3 className="font-semibold text-foreground text-sm sm:text-base">{editing ? "✏️ Edit Product" : "➕ Add Product"}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs sm:text-sm bg-muted px-2.5 py-1.5 rounded-lg">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
            </label>
            <button onClick={handleSave} disabled={uploading} className="bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
              {editing ? "Update" : "Add"}
            </button>
            <button onClick={resetForm} className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> Close
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <input placeholder="Product Name (English) *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Product Name (Hindi)" value={form.name_hi} onChange={(e) => setForm({ ...form, name_hi: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Slug (auto-generated)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Price ₹" value={form['price']} onChange={(e) => setForm({ ...form, price: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" type="number" />
          <input placeholder="MRP ₹" value={form['mrp']} onChange={(e) => setForm({ ...form, mrp: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" type="number" />
          <input placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" type="number" />
          <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <input placeholder="Badge (e.g. Bestseller)" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          <select value={form['category_id']} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
            <option value="">-- Select Primary Category --</option>
            {getCategoryOptions().map(opt => (<option key={opt.id} value={opt.id}>{opt.label}</option>))}
          </select>
          <div className="col-span-1 sm:col-span-2 lg:col-span-3 border border-border rounded-lg p-3 bg-background">
            <p className="text-xs font-medium text-foreground mb-2">📂 Extra Categories <span className="text-muted-foreground font-normal">— tick every additional category (parent or sub) this product should also appear in.</span></p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
              {getCategoryOptions().filter(opt => opt.id !== form['category_id']).map(opt => (
                <label key={opt.id} className={`flex items-center gap-2 text-xs ${opt.isChild ? "pl-4 text-muted-foreground" : "font-semibold text-foreground"}`}>
                  <input type="checkbox" checked={extraCategories.includes(opt.id)}
                    onChange={(e) => setExtraCategories(prev => e.target.checked ? [...prev, opt.id] : prev.filter(id => id !== opt.id))} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <input placeholder="Rating (e.g. 4.5)" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" type="number" step="0.1" min="0" max="5" />
          <input placeholder="Reviews Count" value={form.reviews_count} onChange={(e) => setForm({ ...form, reviews_count: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" type="number" />
          <input type="hidden" value={form.sizes} readOnly />
          <div className="col-span-1">
            <div className="flex gap-1">
              <input
                list="product-type-options"
                value={form.product_type}
                onChange={(e) => setForm({ ...form, product_type: e.target.value })}
                placeholder="Product Type (type custom or pick)"
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background"
              />
              <button type="button" onClick={() => addCustomType(form.product_type)}
                className="px-3 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90">
                + Save
              </button>
            </div>
            <datalist id="product-type-options">
              {BUILTIN_PRODUCT_TYPES.map(pt => <option key={pt} value={pt} />)}
              {customTypes.map(pt => <option key={pt} value={pt} />)}
            </datalist>
            {customTypes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-[10px] text-muted-foreground mr-1 self-center">Custom:</span>
                {customTypes.map(pt => (
                  <span key={pt} className="inline-flex items-center gap-1 text-[11px] bg-muted px-2 py-0.5 rounded-full">
                    {pt}
                    <button type="button" onClick={() => removeCustomType(pt)} className="text-destructive hover:opacity-70" title="Delete this type">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
            <option value="">-- Measurement Unit --</option>
            <option value="gm">GM (Gram)</option>
            <option value="mg">MG (Milligram)</option>
            <option value="ml">ML (Milliliter)</option>
            <option value="kg">KG (Kilogram)</option>
            <option value="cap">CAP (Capsule)</option>
            <option value="tab">TAB (Tablet)</option>
            <option value="piece">Piece</option>
          </select>
          <div>
            <input type="number" min="0" step="any" value={form.base_pack_size}
              onChange={(e) => setForm({ ...form, base_pack_size: e.target.value })}
              placeholder={`Base Pack Size (e.g. 200 ${form.unit ? form.unit.toUpperCase() : "GM"})`}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <p className="text-[10px] text-muted-foreground mt-1">
              Pack quantity is auto-calculated: Base × Pack of N. e.g. 200 GM → Pack of 2 = 400 GM, Pack of 3 = 600 GM.
            </p>
          </div>


        </div>

        <div className="mt-3">
          <input placeholder="Tags (comma separated: ayurveda, herbal, immunity)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          {form.tags && (
            <div className="flex flex-wrap gap-1 mt-2">
              {form.tags.split(",").map((tag, i) => tag.trim() && (
                <span key={i} className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">#{tag.trim()}</span>
              ))}
            </div>
          )}
        </div>

        <textarea placeholder="Description (English)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-3 w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" rows={2} />
        <textarea placeholder="Description (Hindi)" value={form.description_hi} onChange={(e) => setForm({ ...form, description_hi: e.target.value })} className="mt-2 w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" rows={2} />

        <div className="mt-4 bg-muted/50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1">🔍 SEO Meta Tags</h4>
          <input placeholder="Meta Title (for search engines)" value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background mb-2" maxLength={60} />
          <textarea placeholder="Meta Description (for search engines)" value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" rows={2} maxLength={160} />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">Title: {form.meta_title.length}/60</span>
            <span className="text-[10px] text-muted-foreground">Description: {form.meta_description.length}/160</span>
          </div>
        </div>

        {/* Sale schedule */}
        <div className="mt-4 bg-cta/5 rounded-xl p-4 border border-cta/20">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1">🏷️ Sale Schedule (optional)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input type="number" placeholder="Sale Price ₹" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <input type="datetime-local" placeholder="Starts at" value={form.sale_starts_at} onChange={(e) => setForm({ ...form, sale_starts_at: e.target.value })}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <input type="datetime-local" placeholder="Ends at" value={form.sale_ends_at} onChange={(e) => setForm({ ...form, sale_ends_at: e.target.value })}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Leave dates empty for no time limit. Sale price will replace regular price during the window.</p>
        </div>

        {/* Variations (Pack of 1, Pack of 2, etc.) */}
        <div className="mt-4 bg-muted/30 rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1">📦 Variations / Packs (optional)</h4>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => {
                const forms = ["Liquid", "Capsule", "Churn"];
                const packs = [1, 2, 3];
                const basePrice = parseFloat(form['price']) || 0;
                const baseMrp = parseFloat(form['mrp']) || 0;
                const generated = forms.flatMap(f => packs.map(p => ({
                  label: `${f} — Pack of ${p}`,
                  mrp: Math.round(baseMrp * p),
                  price: Math.round(basePrice * p),
                  tagline: p === 1 ? "Starter" : p === 2 ? "Best Value" : "Super Saver",
                })));
                setVariations(generated);
                setForm(prev => ({ ...prev, variation_label: "Form & Pack", variation_display: "card" }));
              }}
                className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:opacity-90 flex items-center gap-1" title="Liquid / Capsule / Churn × Pack of 1, 2, 3">
                ✨ Generate Form × Pack
              </button>
              <button onClick={() => setVariations(v => withPackInfoAll(v, form.base_pack_size, form.unit) as any)}
                className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90" title="Recalculate quantity & per-unit from Base Pack Size">
                🔢 Auto-calc pack quantity
              </button>
              <button onClick={() => setVariations(v => [...v, { label: `Pack of ${v.length + 1}`, mrp: 0, price: 0 }])}
                className="text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add Variation
              </button>

            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <input value={form.variation_label} onChange={e => setForm({ ...form, variation_label: e.target.value })}
              placeholder='Heading label (e.g. "Form", "Pack Size")'
              className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
            <select value={form.variation_display} onChange={e => setForm({ ...form, variation_display: e.target.value })}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
              <option value="card">Display: Card Grid (with image & price)</option>
              <option value="pill">Display: Pill Buttons (simple, like Form)</option>
            </select>
          </div>
          {variations.length === 0 && <p className="text-[11px] text-muted-foreground">Add pack-size or variant options with their own image, MRP, price & tagline (e.g. Pack of 1, Pack of 2). For "Form"-style variants (Capsules / Combo / Powder), set Display to <b>Pill Buttons</b>.</p>}
          {variations.map((v, i) => (
            <div key={i} className="mb-3 p-3 border border-border rounded-lg bg-card">
              <div className="grid grid-cols-12 gap-2 items-start">
                {/* Image */}
                <div className="col-span-12 sm:col-span-3">
                  {v.image ? (
                    <div className="relative">
                      <img loading="lazy" decoding="async" src={v.image} alt="" className="w-full h-24 object-contain rounded-lg border border-border bg-muted" />
                      <button onClick={() => setVariations(arr => arr.map((x, idx) => idx === i ? { ...x, image: "" } : x))}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary text-[10px] text-muted-foreground">
                      <Upload className="h-4 w-4 mb-1" /> Image
                      <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden"
                        onChange={async e => {
                          const [url] = await uploadFilesToBucket(e.target.files);
                          if (url) setVariations(arr => arr.map((x, idx) => idx === i ? { ...x, image: url } : x));
                          e.target.value = "";
                        }} />
                    </label>
                  )}
                  <input
                    value={(v as any).size || ""}
                    onChange={e => setVariations(arr => arr.map((x, idx) => idx === i ? { ...x, size: e.target.value } as any : x))}
                    placeholder="Size (e.g. 60 CAP, 100 ML)"
                    className="mt-1.5 w-full px-2 py-1.5 border border-border rounded-lg text-[11px] bg-background text-center font-medium"
                  />
                </div>
                {/* Fields */}
                <div className="col-span-12 sm:col-span-8 grid grid-cols-12 gap-2">
                  <input value={v.label} onChange={e => setVariations(arr => arr.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                    placeholder="Pack Label (e.g. Starter Pack)" className="col-span-12 px-2 py-2 border border-border rounded-lg text-sm bg-background" />
                  <input type="number" value={v['mrp'] || ""} onChange={e => setVariations(arr => arr.map((x, idx) => idx === i ? { ...x, mrp: parseFloat(e.target.value) || 0 } : x))}
                    placeholder="MRP" className="col-span-6 px-2 py-2 border border-border rounded-lg text-sm bg-background" />
                  <input type="number" value={v['price'] || ""} onChange={e => setVariations(arr => arr.map((x, idx) => {
                      if (idx !== i) return x;
                      const price = parseFloat(e.target.value) || 0;
                      const qty = (x as any).quantity || 0;
                      const unit = form.unit || "unit";
                      const rate = qty > 0 && price > 0 ? +(price / qty).toFixed(2) : 0;
                      return { ...x, price, per_unit: rate ? `₹${rate}/${unit}` : (x as any).per_unit } as any;
                    }))}
                    placeholder="Selling Price" className="col-span-6 px-2 py-2 border border-border rounded-lg text-sm bg-background" />
                  <input type="number" value={(v as any).quantity || ""} onChange={e => setVariations(arr => arr.map((x, idx) => {
                      if (idx !== i) return x;
                      const qty = parseFloat(e.target.value) || 0;
                      const unit = form.unit || "unit";
                      const rate = qty > 0 && x['price'] > 0 ? +(x['price'] / qty).toFixed(2) : 0;
                      const base = Number(form.base_pack_size) || 0;
                      const packs = base > 0 && qty > 0 ? Math.max(1, Math.round(qty / base)) : 1;
                      const size = qty ? (base > 0 ? formatPackSize(base, form.unit, packs) : `${qty} ${unit.toUpperCase()}`) : "";
                      return { ...x, quantity: qty, size, per_unit: rate ? `₹${rate}/${unit}` : "" } as any;
                    }))}
                    placeholder={`Quantity (in ${form.unit || "ml/gm/cap"})`} className="col-span-6 px-2 py-2 border border-border rounded-lg text-sm bg-background" />
                  <input value={(v as any).per_unit || ""} readOnly
                    placeholder="Per unit (auto)" className="col-span-6 px-2 py-2 border border-border rounded-lg text-sm bg-muted text-muted-foreground" />
                  <input value={v.tagline || ""} onChange={e => setVariations(arr => arr.map((x, idx) => idx === i ? { ...x, tagline: e.target.value } : x))}
                    placeholder="Tagline / Badge (e.g. Beginner Friendly, Super Saver)" className="col-span-12 px-2 py-2 border border-border rounded-lg text-sm bg-background" />

                </div>
                <button onClick={() => setVariations(arr => arr.filter((_, idx) => idx !== i))}
                  className="col-span-12 sm:col-span-1 p-2 text-destructive hover:bg-destructive/10 rounded-lg flex justify-center"><X className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>



        {/* Enhanced Product Sections */}
        <div className="mt-4 bg-primary/5 rounded-xl p-4 border border-primary/20 space-y-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1">🌿 Enhanced Product Page (optional)</h4>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Banner / Poster Images — up to 5 <span className="text-muted-foreground font-normal">(one URL per line, or comma / pipe separated). Recommended: <b>1200 × 520 px</b> (wide landscape) or <b>900 × 1400 px</b> (tall portrait). On desktop banner is capped at 520 px height, on mobile it shows at natural size. Max 500 KB each.</span></label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea placeholder={"https://image-1.jpg\nhttps://image-2.jpg\n…up to 5"} value={form.banner_image}
                onChange={e => {
                  const urls = e.target.value.split(/\n|,|\|/).map(s => s.trim()).filter(Boolean).slice(0, 5);
                  setForm({ ...form, banner_image: urls.join("\n") });
                }}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background font-mono" rows={4} />
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary self-start">
                <Upload className="mr-1 h-3.5 w-3.5" /> Upload &amp; Append
                <input type="file" accept=".png,.jpg,.jpeg,.webp" multiple className="hidden"
                  onChange={async (e) => {
                    const urls = await uploadFilesToBucket(e.target.files);
                    if (urls.length) {
                      const existing = form.banner_image.split(/\n|,|\|/).map(s => s.trim()).filter(Boolean);
                      const next = [...existing, ...urls].slice(0, 5);
                      setForm(prev => ({ ...prev, banner_image: next.join("\n") }));
                    }
                    e.target.value = "";
                  }} />
              </label>
            </div>
            {form.banner_image && (
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {form.banner_image.split(/\n|,|\|/).map(s => s.trim()).filter(Boolean).slice(0, 5).map((url, i) => (
                  <div key={i} className="relative group">
                    <img loading="lazy" decoding="async" src={url} alt={`Banner ${i + 1}`} className="h-20 w-full rounded-lg border border-border object-cover" />
                    <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded">#{i + 1}</span>
                    <button type="button" title="Remove this banner"
                      onClick={() => {
                        const list = form.banner_image.split(/\n|,|\|/).map(s => s.trim()).filter(Boolean);
                        list.splice(i, 1);
                        setForm(prev => ({ ...prev, banner_image: list.join("\n") }));
                      }}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 shadow sm:opacity-0 group-hover:opacity-100 transition">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">📱 Mobile Banner Images — up to 5 <span className="text-muted-foreground font-normal">(one URL per line). Shown only on phones. Recommended: <b>1080 × 1350 px</b> (tall). If empty, the desktop banners are used.</span></label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea placeholder={"https://mobile-1.jpg\nhttps://mobile-2.jpg\n…up to 5"} value={form.banner_image_mobile}
                onChange={e => {
                  const urls = e.target.value.split(/\n|,|\|/).map(s => s.trim()).filter(Boolean).slice(0, 5);
                  setForm({ ...form, banner_image_mobile: urls.join("\n") });
                }}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background font-mono" rows={4} />
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary self-start">
                <Upload className="mr-1 h-3.5 w-3.5" /> Upload &amp; Append
                <input type="file" accept=".png,.jpg,.jpeg,.webp" multiple className="hidden"
                  onChange={async (e) => {
                    const urls = await uploadFilesToBucket(e.target.files);
                    if (urls.length) {
                      const existing = form.banner_image_mobile.split(/\n|,|\|/).map(s => s.trim()).filter(Boolean);
                      const next = [...existing, ...urls].slice(0, 5);
                      setForm(prev => ({ ...prev, banner_image_mobile: next.join("\n") }));
                    }
                    e.target.value = "";
                  }} />
              </label>
            </div>
            {form.banner_image_mobile && (
              <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
                {form.banner_image_mobile.split(/\n|,|\|/).map(s => s.trim()).filter(Boolean).slice(0, 5).map((url, i) => (
                  <div key={i} className="relative group">
                    <img loading="lazy" decoding="async" src={url} alt={`Mobile banner ${i + 1}`} className="h-28 w-full rounded-lg border border-border object-cover" />
                    <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded">#{i + 1}</span>
                    <button type="button" title="Remove this mobile banner"
                      onClick={() => {
                        const list = form.banner_image_mobile.split(/\n|,|\|/).map(s => s.trim()).filter(Boolean);
                        list.splice(i, 1);
                        setForm(prev => ({ ...prev, banner_image_mobile: list.join("\n") }));
                      }}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 shadow sm:opacity-0 group-hover:opacity-100 transition">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Banner Video URL <span className="text-muted-foreground font-normal">— YouTube link or Instagram Reel URL (optional)</span></label>
            <input placeholder="https://www.youtube.com/watch?v=… or https://www.instagram.com/reel/…"
              value={form.banner_video_url}
              onChange={e => setForm({ ...form, banner_video_url: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </div>


          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Benefits Section — Wide Banner <span className="text-muted-foreground font-normal">— Recommended: 1200 × 500 px, max 500 KB</span></label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input placeholder="https://..." value={form.benefits_banner} onChange={e => setForm({ ...form, benefits_banner: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary">
                <Upload className="mr-1 h-3.5 w-3.5" /> Upload Banner
                <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => handleSectionBannerUpload("benefits_banner", e)} />
              </label>
            </div>
            {form.benefits_banner && (
              <div className="relative mt-2 inline-block group">
                <img loading="lazy" decoding="async" src={form.benefits_banner} alt="Benefits banner" className="h-24 w-full rounded-lg border border-border object-cover" />
                <button type="button" title="Remove image" onClick={() => setForm(prev => ({ ...prev, benefits_banner: "" }))} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 shadow sm:opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3" /></button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">📱 Benefits Banner — Mobile <span className="text-muted-foreground font-normal">— Recommended: 750 × 900 px. Optional; falls back to desktop.</span></label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input placeholder="https://..." value={form.benefits_banner_mobile} onChange={e => setForm({ ...form, benefits_banner_mobile: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary">
                <Upload className="mr-1 h-3.5 w-3.5" /> Upload Mobile
                <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => handleSectionBannerUpload("benefits_banner_mobile", e)} />
              </label>
            </div>
            {form.benefits_banner_mobile && (
              <div className="relative mt-2 inline-block group">
                <img loading="lazy" decoding="async" src={form.benefits_banner_mobile} alt="Benefits banner mobile" className="h-32 w-auto rounded-lg border border-border object-cover" />
                <button type="button" title="Remove image" onClick={() => setForm(prev => ({ ...prev, benefits_banner_mobile: "" }))} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 shadow sm:opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3" /></button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Ingredients Section — Wide Banner <span className="text-muted-foreground font-normal">— Recommended: 1200 × 500 px, max 500 KB</span></label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input placeholder="https://..." value={form.ingredients_banner} onChange={e => setForm({ ...form, ingredients_banner: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary">
                <Upload className="mr-1 h-3.5 w-3.5" /> Upload Banner
                <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => handleSectionBannerUpload("ingredients_banner", e)} />
              </label>
            </div>
            {form.ingredients_banner && (
              <div className="relative mt-2 inline-block group">
                <img loading="lazy" decoding="async" src={form.ingredients_banner} alt="Ingredients banner" className="h-24 w-full rounded-lg border border-border object-cover" />
                <button type="button" title="Remove image" onClick={() => setForm(prev => ({ ...prev, ingredients_banner: "" }))} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 shadow sm:opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3" /></button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">📱 Ingredients Banner — Mobile <span className="text-muted-foreground font-normal">— Recommended: 750 × 900 px. Optional; falls back to desktop.</span></label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input placeholder="https://..." value={form.ingredients_banner_mobile} onChange={e => setForm({ ...form, ingredients_banner_mobile: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary">
                <Upload className="mr-1 h-3.5 w-3.5" /> Upload Mobile
                <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => handleSectionBannerUpload("ingredients_banner_mobile", e)} />
              </label>
            </div>
            {form.ingredients_banner_mobile && (
              <div className="relative mt-2 inline-block group">
                <img loading="lazy" decoding="async" src={form.ingredients_banner_mobile} alt="Ingredients banner mobile" className="h-32 w-auto rounded-lg border border-border object-cover" />
                <button type="button" title="Remove image" onClick={() => setForm(prev => ({ ...prev, ingredients_banner_mobile: "" }))} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 shadow sm:opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3" /></button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-2 block">Key Benefits</label>
            {benefits.map((b, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 mb-3 rounded-lg border border-border p-2 md:grid-cols-[72px_1fr_2fr_auto]">
                <input value={b.icon} onChange={e => setBenefits(arr => arr.map((x, idx) => idx === i ? { ...x, icon: e.target.value } : x))} placeholder="✅" maxLength={4} className="px-2 py-2 border border-border rounded-lg text-sm bg-background text-center" />
                <input value={b.title} onChange={e => setBenefits(arr => arr.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} placeholder="Title" className="px-2 py-2 border border-border rounded-lg text-sm bg-background" />
                <input value={b.description} onChange={e => setBenefits(arr => arr.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} placeholder="Short description" className="px-2 py-2 border border-border rounded-lg text-sm bg-background" />
                <button onClick={() => setBenefits(arr => arr.filter((_, idx) => idx !== i))} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"><X className="h-4 w-4" /></button>
                <div className="md:col-span-4 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-secondary">
                    <Upload className="mr-1 h-3.5 w-3.5" /> Upload Photo
                    <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { void handleStructuredImageUpload("benefit", i, e.target.files); e.target.value = ""; }} />
                  </label>
                  {(b as any).image && <img loading="lazy" decoding="async" src={(b as any).image} alt={b.title || "Benefit"} className="h-14 w-14 rounded-lg border border-border object-cover" />}
                </div>
              </div>
            ))}
            <button onClick={() => setBenefits(arr => [...arr, { icon: "✅", title: "", description: "", image: "" } as any])} className="text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 flex items-center gap-1"><Plus className="h-3 w-3" /> Add Benefit</button>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-2 block">Key Ingredients</label>
            {ingredients.map((ing, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 mb-3 rounded-lg border border-border p-2 md:grid-cols-[72px_1fr_2fr_auto]">
                <input value={ing.icon} onChange={e => setIngredients(arr => arr.map((x, idx) => idx === i ? { ...x, icon: e.target.value } : x))} placeholder="🌿" maxLength={4} className="px-2 py-2 border border-border rounded-lg text-sm bg-background text-center" />
                <input value={ing.name} onChange={e => setIngredients(arr => arr.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} placeholder="Name" className="px-2 py-2 border border-border rounded-lg text-sm bg-background" />
                <input value={ing.description} onChange={e => setIngredients(arr => arr.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} placeholder="Description" className="px-2 py-2 border border-border rounded-lg text-sm bg-background" />
                <button onClick={() => setIngredients(arr => arr.filter((_, idx) => idx !== i))} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"><X className="h-4 w-4" /></button>
                <div className="md:col-span-4 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-secondary">
                    <Upload className="mr-1 h-3.5 w-3.5" /> Upload Photo
                    <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { void handleStructuredImageUpload("ingredient", i, e.target.files); e.target.value = ""; }} />
                  </label>
                  {(ing as any).image && <img loading="lazy" decoding="async" src={(ing as any).image} alt={ing.name || "Ingredient"} className="h-14 w-14 rounded-lg border border-border object-cover" />}
                </div>
              </div>
            ))}
            <button onClick={() => setIngredients(arr => [...arr, { icon: "🌿", name: "", description: "", image: "" } as any])} className="text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 flex items-center gap-1"><Plus className="h-3 w-3" /> Add Ingredient</button>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">How to Use</label>
            <textarea value={form.how_to_use} onChange={e => setForm({ ...form, how_to_use: e.target.value })} rows={4} placeholder="Step by step usage instructions..." className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-2 block">FAQs</label>
            {faqs.map((faq, i) => (
              <div key={i} className="space-y-1 mb-2 p-2 border border-border rounded-lg">
                <div className="flex gap-2">
                  <input value={faq.q} onChange={e => setFaqs(arr => arr.map((x, idx) => idx === i ? { ...x, q: e.target.value } : x))} placeholder="Question" className="flex-1 px-2 py-1.5 border border-border rounded-lg text-sm bg-background" />
                  <button onClick={() => setFaqs(arr => arr.filter((_, idx) => idx !== i))} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"><X className="h-4 w-4" /></button>
                </div>
                <textarea value={faq.a} onChange={e => setFaqs(arr => arr.map((x, idx) => idx === i ? { ...x, a: e.target.value } : x))} placeholder="Answer" rows={2} className="w-full px-2 py-1.5 border border-border rounded-lg text-sm bg-background" />
              </div>
            ))}
            <button onClick={() => setFaqs(arr => [...arr, { q: "", a: "" }])} className="text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 flex items-center gap-1"><Plus className="h-3 w-3" /> Add FAQ</button>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-base sm:text-lg font-semibold text-foreground mb-2 block">Product Images <span className="text-foreground/70 text-xs font-medium block sm:inline mt-1 sm:mt-0">— Up to 10. Drag-order with <b className="text-primary">◀ ▶</b>. First = main. <b>800×800 px</b>, max 5 MB</span></label>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mb-3">
            {uploadedImages.map((url, idx) => {
              if (!url) return null;
              const firstFilledIdx = uploadedImages.findIndex(Boolean);
              return (
                <div key={idx} className="relative group aspect-square rounded-lg border border-border overflow-hidden bg-muted/30">
                  <img loading="lazy" decoding="async" src={url} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(idx)} className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5"><X className="h-3 w-3" /></button>
                  <div className="absolute bottom-0 inset-x-0 flex items-center justify-between bg-black/55 text-white text-[9px] px-1 py-0.5">
                    <button type="button" disabled={idx === 0} onClick={() => moveImage(idx, -1)} className="px-1 disabled:opacity-30">◀</button>
                    <span className="font-bold">{idx === firstFilledIdx ? "Main" : idx + 1}</span>
                    <button type="button" disabled={idx >= uploadedImages.length - 1} onClick={() => moveImage(idx, 1)} className="px-1 disabled:opacity-30">▶</button>
                  </div>
                </div>
              );
            })}
            {uploadedImages.filter(Boolean).length < 10 && (
              <button type="button" onClick={() => { setUploadTargetIdx(uploadedImages.length); fileInputRef.current?.click(); }} disabled={uploading}
                className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition cursor-pointer disabled:opacity-50">
                {uploading ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <><Upload className="h-4 w-4" /><span className="text-[10px] font-medium">Add</span></>}
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp" multiple onChange={handleImageUpload} className="hidden" />
        </div>


        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground">Product Features</label>
            <button onClick={addDefaultFeatures} className="text-xs text-primary hover:underline">+ Defaults</button>
          </div>
          {features.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {features.map((f, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-sm">
                  {f.icon} {f.text}
                  <button onClick={() => removeFeature(idx)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input placeholder="Emoji" value={newFeature.icon} onChange={(e) => setNewFeature({ ...newFeature, icon: e.target.value })}
              className="w-16 px-3 py-2 border border-border rounded-lg text-sm bg-background text-center" maxLength={4} />
            <input placeholder="Feature text" value={newFeature.text} onChange={(e) => setNewFeature({ ...newFeature, text: e.target.value })}
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background"
              onKeyDown={(e) => e.key === "Enter" && addFeature()} />
            <button onClick={addFeature} className="bg-secondary text-secondary-foreground px-3 py-2 rounded-lg text-sm hover:opacity-90">Add</button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={handleSave} disabled={uploading} className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
            {editing ? "Update" : "Add"} Product
          </button>
          {editing && <button onClick={resetForm} className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-medium">Cancel</button>}
        </div>
      </div>
      )}
      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="px-2 py-3 w-8">
              <input type="checkbox" checked={selected.size === filteredProducts.length && filteredProducts.length > 0}
                onChange={e => setSelected(e.target.checked ? new Set(filteredProducts.map(p => p.id)) : new Set())} />
            </th>
            <th className="text-left px-2 py-3 font-medium text-muted-foreground">Image</th>
            <th className="text-left px-2 py-3 font-medium text-muted-foreground">Name</th>
            <th className="text-left px-2 py-3 font-medium text-muted-foreground">MRP</th>
            <th className="text-left px-2 py-3 font-medium text-muted-foreground">Selling Price</th>
            <th className="text-left px-2 py-3 font-medium text-muted-foreground">Qty</th>
            <th className="text-left px-2 py-3 font-medium text-muted-foreground">Badge</th>
            <th className="text-left px-2 py-3 font-medium text-muted-foreground">Rating</th>
            <th className="text-left px-2 py-3 font-medium text-muted-foreground">Reviews</th>
            <th className="text-left px-2 py-3 font-medium text-muted-foreground">Status</th>
            <th className="text-left px-2 py-3 font-medium text-muted-foreground">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
            filteredProducts.length === 0 ? <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">No products found.</td></tr> :
            filteredProducts.map((p) => {
              const edit = rowEdits[p.id] || {};
              const curName = edit.name ?? (p.name ?? "");
              const curMrp = edit['mrp'] ?? String(p['mrp'] ?? "");
              const curPrice = edit['price'] ?? String(p['price'] ?? "");
              const curStock = edit.stock ?? String(p.stock ?? "");
              const curBadge = edit.badge ?? (p.badge ?? "");
              const curRating = edit.rating ?? String(p.rating ?? "");
              const curReviews = edit.reviews_count ?? String(p.reviews_count ?? "");
              const curActive = edit.is_active ?? (p.is_active !== false);
              const dirty = edit.name !== undefined || edit['mrp'] !== undefined || edit['price'] !== undefined || edit.stock !== undefined || edit.is_active !== undefined || edit.badge !== undefined || edit.rating !== undefined || edit.reviews_count !== undefined;
              const setEdit = (patch: Partial<{ name: string; mrp: string; price: string; stock: string; is_active: boolean; badge: string; rating: string; reviews_count: string }>) =>
                setRowEdits(prev => ({ ...prev, [p.id]: { ...prev[p.id], ...patch } }));
              const saveRow = async () => {
                setSavingRow(p.id);
                const payload: any = {
                  name: curName.trim() || p.name,
                  mrp: parseFloat(curMrp) || 0,
                  price: parseFloat(curPrice) || 0,
                  stock: parseInt(curStock) || 0,
                  badge: curBadge ? String(curBadge).trim() : null,
                  rating: parseFloat(curRating) || 0,
                  reviews_count: parseInt(curReviews) || 0,
                  is_active: curActive,
                };
                const { error } = await supabase.from("products").update(payload).eq("id", p.id);
                setSavingRow(null);
                if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
                toast({ title: "✅ Saved" });
                setProducts(prev => prev.map(x => x.id === p.id ? { ...x, ...payload } : x));
                setRowEdits(prev => { const n = { ...prev }; delete n[p.id]; return n; });
              };
              return (
                <tr key={p.id} className={`border-t border-border hover:bg-muted/50 ${selected.has(p.id) ? 'bg-primary/5' : ''}`}>
                  <td className="px-2 py-3 w-8">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} />
                  </td>
                  <td className="px-2 py-3">{p.image_url ? <img loading="lazy" decoding="async" src={p.image_url} alt={p.name} className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-muted flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>}</td>
                  <td className="px-2 py-3 font-medium text-foreground min-w-[180px]">
                    <input type="text" value={curName} onChange={e => setEdit({ name: e.target.value })}
                      className="w-full px-2 py-1 border border-border rounded text-xs sm:text-sm bg-background font-medium" />
                    {p.name_hi && <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{p.name_hi}</div>}
                  </td>
                  <td className="px-2 py-3">
                    <input type="number" value={curMrp} onChange={e => setEdit({ mrp: e.target.value })}
                      className="w-20 px-2 py-1 border border-border rounded text-xs bg-background" />
                  </td>
                  <td className="px-2 py-3">
                    <input type="number" value={curPrice} onChange={e => setEdit({ price: e.target.value })}
                      className="w-20 px-2 py-1 border border-border rounded text-xs bg-background" />
                  </td>
                  <td className="px-2 py-3">
                    <input type="number" value={curStock} onChange={e => setEdit({ stock: e.target.value })}
                      className="w-16 px-2 py-1 border border-border rounded text-xs bg-background" />
                  </td>
                  <td className="px-2 py-3">
                    <input type="text" placeholder="Bestseller" value={curBadge} onChange={e => setEdit({ badge: e.target.value })}
                      className="w-24 px-2 py-1 border border-border rounded text-xs bg-background" />
                  </td>
                  <td className="px-2 py-3">
                    <input type="number" step="0.1" min="0" max="5" value={curRating} onChange={e => setEdit({ rating: e.target.value })}
                      className="w-16 px-2 py-1 border border-border rounded text-xs bg-background" />
                  </td>
                  <td className="px-2 py-3">
                    <input type="number" value={curReviews} onChange={e => setEdit({ reviews_count: e.target.value })}
                      className="w-20 px-2 py-1 border border-border rounded text-xs bg-background" />
                  </td>
                  <td className="px-2 py-3">
                    <button onClick={() => setEdit({ is_active: !curActive })}
                      className={`text-[10px] px-2 py-1 rounded-full font-medium transition ${curActive ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                      {curActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex gap-1">
                      <button onClick={saveRow} disabled={!dirty || savingRow === p.id}
                        title="Save changes"
                        className={`p-1.5 rounded transition flex items-center gap-1 text-xs font-semibold ${dirty ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
                        {savingRow === p.id ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <><Save className="h-3 w-3" /> Save</>}
                      </button>
                      <a href={`/product/${p.slug}`} target="_blank" rel="noopener noreferrer" title="View live on website" className="p-1.5 hover:bg-primary/10 rounded transition"><ExternalLink className="h-3.5 w-3.5 text-primary" /></a>
                      <button onClick={() => handleEdit(p)} title="Edit full product" className="p-1.5 hover:bg-secondary rounded transition"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      <button onClick={() => handleDuplicate(p.id)} title="Duplicate product" className="p-1.5 hover:bg-primary/10 rounded transition"><Copy className="h-3.5 w-3.5 text-primary" /></button>
                      <button onClick={() => handleDelete(p.id, p.name)} title="Delete product" className="p-1.5 hover:bg-destructive/10 rounded transition"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>

                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showBulkEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !bulkSaving && setShowBulkEdit(false)}>
          <div className="bg-card rounded-xl border border-border p-5 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">Bulk Edit ({selected.size} products)</h3>
              <button onClick={() => setShowBulkEdit(false)} disabled={bulkSaving} className="p-1 hover:bg-secondary rounded"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Sirf woh fields fill karein jo sab selected products par apply karne hain. Khali fields skip ho jayengi.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">MRP (₹)</label>
                <input type="number" value={bulkEdit['mrp']} onChange={e => setBulkEdit({ ...bulkEdit, mrp: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Price (₹)</label>
                <input type="number" value={bulkEdit['price']} onChange={e => setBulkEdit({ ...bulkEdit, price: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Discount % (auto Price = MRP - discount)</label>
                <input type="number" value={bulkEdit.discount_pct} onChange={e => setBulkEdit({ ...bulkEdit, discount_pct: e.target.value })} placeholder="e.g. 30" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Stock</label>
                <input type="number" value={bulkEdit.stock} onChange={e => setBulkEdit({ ...bulkEdit, stock: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <select value={bulkEdit.is_active} onChange={e => setBulkEdit({ ...bulkEdit, is_active: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background">
                  <option value="">— No change —</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Badge</label>
                <input value={bulkEdit.badge} onChange={e => setBulkEdit({ ...bulkEdit, badge: e.target.value })} placeholder="e.g. Bestseller or __clear__" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <select value={bulkEdit['category_id']} onChange={e => setBulkEdit({ ...bulkEdit, category_id: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background">
                  <option value="">— No change —</option>
                  {getCategoryOptions().map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowBulkEdit(false)} disabled={bulkSaving} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-secondary">Cancel</button>
              <button onClick={runBulkEdit} disabled={bulkSaving} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-60 flex items-center gap-1">
                {bulkSaving ? <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Saving...</> : <><Save className="h-3.5 w-3.5" /> Apply to {selected.size}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
