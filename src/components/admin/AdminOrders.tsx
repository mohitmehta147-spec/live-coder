import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { trashDeleteOrder } from "@/lib/trash";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, MapPin, Phone, Mail, Save, Pencil, Trash2, Download, Filter, X, RefreshCw, Plus } from "lucide-react";
import * as XLSX from "xlsx";
import CreateOrderModal from "./CreateOrderModal";

const AdminOrders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({ product_name: "", quantity: "", price: "", variant: "" });
  const [editForm, setEditForm] = useState({ address: "", city: "", pincode: "", customer_phone: "", notes: "", payment_status: "", customer_remark: "", internal_remark: "" });
  const [viewedOrders, setViewedOrders] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(window.localStorage.getItem("admin_viewed_orders") || "[]")); } catch { return new Set(); }
  });
  const markViewed = (id: string) => {
    setViewedOrders(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev); next.add(id);
      try { window.localStorage.setItem("admin_viewed_orders", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterCity, setFilterCity] = useState("");
  const [filterState, setFilterState] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowsPerPage, setRowsPerPage] = useState<number>(() => {
    const saved = typeof window !== "undefined" ? window.sessionStorage.getItem("admin_orders_per_page") : null;
    const parsed = Number(saved || 50);
    return [10, 50, 1000].includes(parsed) ? parsed : 50;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [importStatus, setImportStatus] = useState("");
  // Cancel-reason modal state
  const [cancelTarget, setCancelTarget] = useState<{ ids: string[]; mode: "single" | "bulk" } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonCustom, setCancelReasonCustom] = useState("");
  const [cancelInternal, setCancelInternal] = useState("");
  const CANCEL_REASONS = [
    "Out of stock",
    "Customer requested cancellation",
    "Payment failed / not received",
    "Wrong or incomplete address",
    "Duplicate order",
    "Delivery not available in this area",
    "Suspicious / fraudulent order",
    "Other (specify below)",
  ];

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Move ${selected.size} order(s) to Trash? You can restore within 30 days.`)) return;
    const ids = Array.from(selected);
    try {
      let failed = 0;
      for (const id of ids) {
        const { error } = await trashDeleteOrder(id);
        if (error) failed++;
      }
      if (failed) toast({ title: `Moved ${ids.length - failed}, ${failed} failed`, variant: "destructive" });
      else toast({ title: `🗑️ Moved ${ids.length} order(s) to Trash` });
      setSelected(new Set());
      fetchOrders();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };
  const bulkUpdateStatus = async (status: string) => {
    if (!status || selected.size === 0) return;
    if (!confirm(`Change status of ${selected.size} order(s) to "${status}"?`)) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("orders").update({ status }).in("id", ids);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status } : o));
    setSelected(new Set());
    toast({ title: `✅ ${ids.length} order(s) → ${status}` });
  };
  const toggleSel = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleWPImport = async () => {
    if (!confirm("Import ALL orders from WordPress/WooCommerce? This processes in batches and may take a few minutes. Existing orders (matched by order number) will be updated.")) return;
    setImporting(true);
    setImportStatus("Starting import...");
    let totalImported = 0, totalUpdated = 0, totalFailed = 0;
    let nextPage: number | null = 1;
    try {
      while (nextPage) {
        const { data, error } = await supabase.functions.invoke("wc-import-orders", {
          body: { startPage: nextPage, pages: 1, perPage: 100 },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        totalImported += data.imported || 0;
        totalUpdated += data.updated || 0;
        totalFailed += data.failed || 0;
        const processedPage = data.nextPage ? data.nextPage - 1 : data.totalPages;
        setImportStatus(`Imported page ${processedPage} of ${data.totalPages}...`);
        if (processedPage === 1 || processedPage === data.totalPages || processedPage % 5 === 0) {
          toast({
            title: `Batch done (page ${processedPage})`,
            description: `+${data.imported} new, +${data.updated} updated. Total pages: ${data.totalPages}`,
          });
        }
        nextPage = data.nextPage ?? null;
      }
      setImportStatus(`Done. Imported ${totalImported}, updated ${totalUpdated}, failed ${totalFailed}.`);
      toast({ title: "✅ Import complete", description: `Imported ${totalImported}, updated ${totalUpdated}, failed ${totalFailed}` });
      fetchOrders();
    } catch (e: any) {
      setImportStatus("Import stopped before completion.");
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };
  const { toast } = useToast();

  const fetchOrders = async () => {
    const chunkSize = 1000;
    let from = 0;
    let allOrders: any[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + chunkSize - 1);

      if (error) {
        toast({ title: "Error loading orders", description: error.message, variant: "destructive" });
        break;
      }

      const batch = data || [];
      allOrders = [...allOrders, ...batch];
      if (batch.length < chunkSize) break;
      from += chunkSize;
    }

    setOrders(allOrders);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  // Catalog of existing products for the "Add/Edit Item" picker
  const [availableProducts, setAvailableProducts] = useState<{ id: string; name: string; price: number; mrp: number | null; slug: string; image_url: string | null }[]>([]);
  useEffect(() => {
    supabase.from("products").select("id, name, price, mrp, slug, image_url").eq("is_active", true).order("name").limit(2000)
      .then(({ data }) => setAvailableProducts((data || []) as any));
  }, []);

  const filteredOrders = useMemo(() => orders.filter(o => {
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (filterPayment !== "all" && (o.payment_status || "unpaid") !== filterPayment) return false;
    if (filterCity.trim() && !(o.city || "").toLowerCase().includes(filterCity.trim().toLowerCase())) return false;
    if (filterState.trim() && !(o.state || "").toLowerCase().includes(filterState.trim().toLowerCase())) return false;
    if (fromDate) {
      if (new Date(o.created_at) < new Date(fromDate + "T00:00:00")) return false;
    }
    if (toDate) {
      if (new Date(o.created_at) > new Date(toDate + "T23:59:59")) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return o.customer_name?.toLowerCase().includes(q) || o.customer_phone?.includes(q) || o.customer_email?.toLowerCase().includes(q) || o.id?.toLowerCase().includes(q) || o.order_number?.toLowerCase().includes(q);
    }
    return true;
  }), [orders, filterStatus, filterPayment, filterCity, filterState, fromDate, toDate, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterPayment, filterCity, filterState, fromDate, toDate, searchQuery, rowsPerPage]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("admin_orders_per_page", String(rowsPerPage));
    }
  }, [rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (safeCurrentPage - 1) * rowsPerPage;
    return filteredOrders.slice(start, start + rowsPerPage);
  }, [filteredOrders, rowsPerPage, safeCurrentPage]);
  const isCurrentPageFullySelected = paginatedOrders.length > 0 && paginatedOrders.every((order) => selected.has(order.id));

  const loadOrderItems = async (orderId: string) => {
    markViewed(orderId);
    if (orderItems[orderId]) {
      setExpandedOrder(expandedOrder === orderId ? null : orderId);
      return;
    }
    setExpandedOrder(orderId);
    const { data } = await supabase.from("order_items").select("*").eq("order_id", orderId);
    let items: any[] = data || [];
    if (items.length === 0) {
      const order = orders.find(o => o.id === orderId);
      const raw = Array.isArray(order?.items) ? order!.items : [];
      items = raw.map((it: any, idx: number) => ({
        id: `${orderId}-j-${idx}`,
        order_id: orderId,
        product_id: it.product_id || it.id || null,
        slug: it.slug || null,
        product_name: it.name || it.product_name || it.title || "Item",
        variant: it.variant || it.pack || it.size || it.variation_label || it.option || "",
        quantity: Number(it.quantity || it.qty || 1),
        price: Number(it['price'] || it.unit_price || it.total || 0),
        _legacyIndex: idx,
      }));
    } else {
      // Enrich DB items with slug from products table for clickable link
      const ids = Array.from(new Set(items.map((it: any) => it.product_id).filter(Boolean)));
      if (ids.length) {
        const { data: prods } = await supabase.from("products").select("id,slug,name").in("id", ids);
        const slugById: Record<string, string> = {};
        (prods || []).forEach((p: any) => { if (p.id) slugById[p.id] = p.slug; });
        items = items.map((it: any) => ({ ...it, slug: it.slug || slugById[it.product_id] || null }));
      }
    }
    setOrderItems(prev => ({ ...prev, [orderId]: items }));
  };

  const updateStatus = async (id: string, status: string) => {
    markViewed(id);
    if (status === "cancelled") {
      setCancelReason(""); setCancelReasonCustom(""); setCancelInternal("");
      setCancelTarget({ ids: [id], mode: "single" });
      return;
    }
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
    } else {
      setOrders(orders.map((o) => o.id === id ? { ...o, status } : o));
      toast({ title: "✅ Status updated to " + status });
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const reason = cancelReason === "Other (specify below)" ? cancelReasonCustom.trim() : cancelReason;
    if (!reason) { toast({ title: "Please choose a cancellation reason", variant: "destructive" }); return; }
    const ids = cancelTarget.ids;
    const { error } = await supabase.from("orders").update({
      status: "cancelled",
      cancellation_reason: reason,
      cancellation_reason_internal: cancelInternal.trim() || null,
      cancelled_at: new Date().toISOString(),
      cancelled_by: "admin",
    } as any).in("id", ids);
    if (error) { toast({ title: "Cancel failed", description: error.message, variant: "destructive" }); return; }
    setOrders(orders.map(o => ids.includes(o.id) ? {
      ...o, status: "cancelled", cancellation_reason: reason,
      cancellation_reason_internal: cancelInternal.trim() || null,
      cancelled_at: new Date().toISOString(), cancelled_by: "admin",
    } : o));
    toast({ title: `✅ ${ids.length} order(s) cancelled` });
    setCancelTarget(null);
  };

  const startEditing = (o: any) => {
    setEditingOrder(o.id);
    setEditForm({
      address: o.address || "", city: o.city || "", pincode: o.pincode || "",
      customer_phone: o.customer_phone || "", notes: o.notes || "",
      payment_status: o.payment_status || "unpaid",
      customer_remark: o.customer_remark || "",
      internal_remark: o.internal_remark || "",
    });
  };

  const saveOrderEdit = async (id: string) => {
    const { error } = await supabase.from("orders").update({
      address: editForm.address, city: editForm.city || null, pincode: editForm.pincode || null,
      customer_phone: editForm.customer_phone, notes: editForm.notes || null,
      payment_status: editForm.payment_status,
      customer_remark: editForm.customer_remark || null,
      internal_remark: editForm.internal_remark || null,
    } as any).eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      setOrders(orders.map(o => o.id === id ? { ...o, ...editForm } : o));
      setEditingOrder(null);
      toast({ title: "✅ Order details updated" });
    }
  };

  const startEditingItem = (item: any) => {
    setEditingItem(item.id);
    setItemForm({ product_name: item.product_name, quantity: String(item.quantity), price: String(item['price']), variant: item.variant || "" } as any);
  };

  const persistLegacyItems = async (orderId: string, items: any[]) => {
    const jsonItems = items.map(i => ({
      id: i.product_id || null,
      product_id: i.product_id || null,
      slug: i.slug || null,
      name: i.product_name,
      variant: i.variant || "",
      quantity: Number(i.quantity) || 1,
      price: Number(i['price']) || 0,
    }));
    const newTotal = jsonItems.reduce((s, i) => s + i['price'] * i.quantity, 0);
    await supabase.from("orders").update({ items: jsonItems as any, total: newTotal } as any).eq("id", orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, items: jsonItems, total: newTotal } : o));
  };

  const saveItemEdit = async (itemId: string, orderId: string) => {
    const existing = (orderItems[orderId] || []).find(i => i.id === itemId);
    const isLegacy = itemId.includes("-j-");
    const patch = {
      product_name: itemForm.product_name,
      variant: (itemForm as any).variant || existing?.variant || "",
      quantity: parseInt(itemForm.quantity) || 1,
      price: parseFloat(itemForm['price']) || 0,
    };
    if (isLegacy) {
      const updated = (orderItems[orderId] || []).map(i => i.id === itemId ? { ...i, ...patch } : i);
      setOrderItems(prev => ({ ...prev, [orderId]: updated }));
      await persistLegacyItems(orderId, updated);
      setEditingItem(null);
      toast({ title: "✅ Item updated" });
      return;
    }
    const { error } = await supabase.from("order_items").update({
      product_name: patch.product_name,
      quantity: patch.quantity,
      price: patch['price'],
    }).eq("id", itemId);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      const updatedItems = (orderItems[orderId] || []).map(i => i.id === itemId ? { ...i, ...patch } : i);
      setOrderItems(prev => ({ ...prev, [orderId]: updatedItems }));
      const newTotal = updatedItems.reduce((sum: number, i: any) => sum + (i['price'] * i.quantity), 0);
      await supabase.from("orders").update({ total: newTotal }).eq("id", orderId);
      setOrders(orders.map(o => o.id === orderId ? { ...o, total: newTotal } : o));
      setEditingItem(null);
      toast({ title: "✅ Item updated" });
    }
  };

  const deleteItem = async (itemId: string, orderId: string, name: string) => {
    if (!confirm(`⚠️ Delete the item "${name}" from this order?\n\nThe order total will be recalculated.`)) return;
    const isLegacy = itemId.includes("-j-");
    if (isLegacy) {
      const updated = (orderItems[orderId] || []).filter(i => i.id !== itemId);
      setOrderItems(prev => ({ ...prev, [orderId]: updated }));
      await persistLegacyItems(orderId, updated);
      toast({ title: "✅ Item deleted" });
      return;
    }
    const { error } = await supabase.from("order_items").delete().eq("id", itemId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      const updated = orderItems[orderId].filter(i => i.id !== itemId);
      setOrderItems(prev => ({ ...prev, [orderId]: updated }));
      const newTotal = updated.reduce((sum: number, i: any) => sum + (i['price'] * i.quantity), 0);
      await supabase.from("orders").update({ total: newTotal }).eq("id", orderId);
      setOrders(orders.map(o => o.id === orderId ? { ...o, total: newTotal } : o));
      toast({ title: "✅ Item deleted" });
    }
  };

  const deleteOrder = async (orderId: string, orderLabel: string) => {
    if (!confirm(`Move order ${orderLabel} to Trash? You can restore within 30 days.`)) return;
    const { error } = await trashDeleteOrder(orderId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setOrderItems(prev => { const next = { ...prev }; delete next[orderId]; return next; });
      if (expandedOrder === orderId) setExpandedOrder(null);
      toast({ title: "🗑️ Moved to Trash" });
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "confirmed": return "bg-blue-100 text-blue-800";
      case "shipped": return "bg-purple-100 text-purple-800";
      case "delivered": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const downloadAdminInvoice = async (order: any, items: any[]) => {
    const date = new Date(order.created_at).toLocaleString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    const orderLabel = order.order_number || order.id.slice(0, 8).toUpperCase();

    // Lookup MRP from products table (order_items doesn't store MRP)
    const productIds = Array.from(new Set(items.map(it => it.product_id).filter(Boolean)));
    const names = Array.from(new Set(items.map(it => it.product_name).filter(Boolean)));
    const mrpById: Record<string, number> = {};
    const mrpByName: Record<string, number> = {};
    if (productIds.length || names.length) {
      const { data: prods } = await supabase.from("products").select("id, name, mrp, price").or(
        [productIds.length ? `id.in.(${productIds.join(",")})` : "", names.length ? `name.in.(${names.map(n => `"${String(n).replace(/"/g, '\\"')}"`).join(",")})` : ""].filter(Boolean).join(",")
      );
      (prods || []).forEach((p: any) => {
        const m = Number(p['mrp'] || p['price'] || 0);
        if (p.id) mrpById[p.id] = m;
        if (p.name) mrpByName[p.name] = m;
      });
    }
    const getItemMrp = (it: any) => {
      const v = Number(it['mrp'] || mrpById[it.product_id] || mrpByName[it.product_name] || it['price'] || 0);
      return v > Number(it['price'] || 0) ? v : Number(it['price'] || 0);
    };

    const totalMrp = items.reduce((s: number, it: any) => s + (getItemMrp(it) * Number(it.quantity || 0)), 0);
    const subtotal = items.reduce((s: number, it: any) => s + Number(it['price'] || 0) * Number(it.quantity || 0), 0);
    const mrpDiscount = Math.max(0, totalMrp - subtotal);
    const couponDiscount = Number(order.discount || 0);
    const shippingCharge = Number(order.shipping || 0);
    const grandTotal = Number(order.total || subtotal - couponDiscount + shippingCharge);
    const totalSavings = mrpDiscount + couponDiscount;
    const pct = totalMrp > 0 ? Math.round((totalSavings / totalMrp) * 100) : 0;
    const payMethod = (order.payment_method || (order.payment_status === "paid" ? "PAID" : "COD")).toUpperCase();
    const txnId = order.payment_id || "";
    const payTime = order.payment_status === "paid" && order.updated_at
      ? new Date(order.updated_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })
      : "";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Order Booking ${orderLabel}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#333;background:#fff;padding:40px}.invoice{max-width:720px;margin:0 auto}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:3px solid #3D8B37;padding-bottom:14px;gap:20px}.brand{display:flex;align-items:flex-start;gap:12px}.brand-logo{width:60px;height:60px;border-radius:10px;object-fit:contain}.brand-text{font-size:24px;font-weight:bold;color:#3D8B37;line-height:1.1}.brand-sub{font-size:11px;color:#888;margin-top:2px}.company-info{font-size:11px;color:#444;line-height:1.5;margin-top:6px}.company-info strong{color:#1f2937}.inv-title{text-align:right;flex-shrink:0}.inv-title h2{font-size:24px;color:#3D8B37}.inv-title p{font-size:12px;color:#666;margin-top:4px}.order-id{font-size:18px;font-weight:bold;color:#3D8B37;letter-spacing:0.5px}.info-grid{display:flex;justify-content:space-between;margin-bottom:25px;gap:20px}.info-box{flex:1}.info-box h4{font-size:11px;text-transform:uppercase;color:#888;margin-bottom:6px;letter-spacing:1px}.info-box p{font-size:13px;line-height:1.6}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#3D8B37;color:#fff;padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase}td{padding:10px 12px;border-bottom:1px solid #eee;font-size:13px}['mrp']-strike{color:#999;text-decoration:line-through;font-size:11px}tr:nth-child(even){background:#f9f9f9}.totals{margin-left:auto;width:340px;font-size:13px}.totals .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}.totals .row.discount{color:#16a34a}.totals .row.savings{background:#f0fdf4;padding:8px 10px;border-radius:6px;color:#166534;font-weight:600;border:none;margin:6px 0}.totals .row.grand{border-top:2px solid #3D8B37;border-bottom:none;font-size:16px;font-weight:bold;color:#3D8B37;padding-top:10px;margin-top:6px}.footer{margin-top:30px;padding-top:15px;border-top:1px solid #eee;text-align:center;font-size:11px;color:#999}@media print{body{padding:20px}.no-print{display:none}}</style>
</head><body><div class="invoice"><div class="header"><div class="brand"><img src="${window.location.origin}/logo.png" class="brand-logo" onerror="this.style.display='none'" /><div><div class="brand-text">Vedic Upchar Pvt Ltd</div><div class="brand-sub">Authentic Ayurvedic Healthcare</div><div class="company-info"><strong>GSTIN:</strong> 07AADCV8879J1ZI<br/><strong>Address:</strong> 307/3, Shahzada Bagh, Industrial Area,<br/>Near Metro Pillar No.188, Ram Dharam Kanta Wali Gali,<br/>Inderlok, Delhi 110035<br/>📞 +91 8448797693 &nbsp;|&nbsp; ✉️ vedicupchar11@gmail.com</div></div></div><div class="inv-title"><h2>ORDER BOOKING</h2><p class="order-id">Order ID: ${orderLabel}</p><p>📅 ${date}</p></div></div>
<div class="info-grid"><div class="info-box"><h4>Bill To</h4><p><strong>${order.customer_name || ""}</strong></p><p>${order.address || ""}</p>${order.city||order.state||order.pincode?`<p>${[order.city,order.state,order.pincode].filter(Boolean).join(", ")}</p>`:""}<p>📞 ${order.customer_phone || ""}</p>${order.customer_email?`<p>✉️ ${order.customer_email}</p>`:""}</div><div class="info-box" style="text-align:right"><h4>Payment</h4><p><strong>${payMethod}</strong></p>${txnId?`<p style="font-size:11px;color:#666"><strong>Txn ID:</strong> <span style="font-family:monospace">${txnId}</span></p>`:""}${payTime?`<p style="font-size:11px;color:#666"><strong>Paid:</strong> ${payTime}</p>`:""}<h4 style="margin-top:12px">Status</h4><p>${order.status || ""}</p></div></div>
<table><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>MRP</th><th>Sale Price</th><th style="text-align:right">Amount</th></tr></thead><tbody>${items.map((item:any,i:number)=>{const m=getItemMrp(item);const showStrike=m>Number(item['price']||0);return `<tr><td>${i+1}</td><td>${item.product_name}</td><td>${item.quantity}</td><td>${showStrike?`<span class="mrp-strike">₹${m.toFixed(0)}</span>`:`₹${m.toFixed(0)}`}</td><td><strong>₹${item['price']}</strong></td><td style="text-align:right"><strong>₹${(item['price']*item.quantity).toFixed(2)}</strong></td></tr>`;}).join("")}</tbody></table>
<div class="totals">
  <div class="row"><span>Total MRP</span><span>₹${totalMrp.toFixed(2)}</span></div>
  ${mrpDiscount>0?`<div class="row discount"><span>Product Discount${pct>0?` (${pct}%)`:""}</span><span>- ₹${mrpDiscount.toFixed(2)}</span></div>`:""}
  <div class="row"><span>Subtotal (after discount)</span><span>₹${subtotal.toFixed(2)}</span></div>
  ${couponDiscount>0?`<div class="row discount"><span>Coupon Discount</span><span>- ₹${couponDiscount.toFixed(2)}</span></div>`:""}
  <div class="row"><span>Shipping Charges</span><span>${shippingCharge>0?`+ ₹${shippingCharge.toFixed(2)}`:"FREE"}</span></div>
  ${totalSavings>0?`<div class="row savings"><span>🧾 You Saved</span><span>₹${totalSavings.toFixed(2)}${pct>0?` (${pct}%)`:""}</span></div>`:""}
  <div class="row grand"><span>Grand Total</span><span>₹${grandTotal.toFixed(2)}</span></div>
</div>
<div class="footer"><p>Thank you for shopping with VedicUpchar! 🌿</p><p style="margin-top:4px">📞 +91 8448797693 &nbsp;|&nbsp; ✉️ vedicupchar11@gmail.com</p></div></div>
<script class="no-print">window.onload=()=>window.print()</script></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };


  const exportOrdersCSV = async () => {
    const sourceOrders = filteredOrders.length ? filteredOrders : orders;
    const orderIds = sourceOrders.map((order) => order.id);
    // Page through order_items in chunks to avoid URL/row limits
    const CHUNK = 200;
    let allItems: any[] = [];
    for (let i = 0; i < orderIds.length; i += CHUNK) {
      const slice = orderIds.slice(i, i + CHUNK);
      const { data } = await supabase.from("order_items").select("order_id, product_id, product_name, quantity, price").in("order_id", slice);
      allItems = allItems.concat(data || []);
    }
    const itemMap = allItems.reduce((acc: Record<string, any[]>, item: any) => {
      acc[item.order_id] = [...(acc[item.order_id] || []), item];
      return acc;
    }, {});

    // Fallback: for orders missing order_items rows, use orders.items JSON column
    sourceOrders.forEach((o: any) => {
      if (!itemMap[o.id] && Array.isArray(o.items) && o.items.length > 0) {
        itemMap[o.id] = o.items.map((it: any) => ({
          order_id: o.id,
          product_id: it.product_id || it.id || null,
          product_name: it.name || it.product_name || it.title || "Item",
          quantity: Number(it.quantity || it.qty || 1),
          price: Number(it['price'] || it.unit_price || it.total || 0),
          mrp: Number(it['mrp'] || 0),
        }));
      }
    });

    // Lookup MRPs from products table (order_items doesn't store mrp)
    const allProductIds = Array.from(new Set(Object.values(itemMap).flat().map((it: any) => it.product_id).filter(Boolean)));
    const allNames = Array.from(new Set(Object.values(itemMap).flat().map((it: any) => it.product_name).filter(Boolean)));
    const mrpById: Record<string, number> = {};
    const mrpByName: Record<string, number> = {};
    if (allProductIds.length || allNames.length) {
      // Batch product lookup (paginate by id chunks)
      for (let i = 0; i < allProductIds.length; i += 200) {
        const slice = allProductIds.slice(i, i + 200);
        const { data: prods } = await supabase.from("products").select("id, name, mrp, price").in("id", slice);
        (prods || []).forEach((p: any) => {
          const m = Number(p['mrp'] || p['price'] || 0);
          if (p.id) mrpById[p.id] = m;
          if (p.name) mrpByName[p.name] = m;
        });
      }
      // Also lookup by name for items missing product_id
      const namesMissing = allNames.filter(n => !Object.values(mrpByName).length || !mrpByName[n as string]);
      for (let i = 0; i < namesMissing.length; i += 100) {
        const slice = namesMissing.slice(i, i + 100);
        const { data: prods } = await supabase.from("products").select("id, name, mrp, price").in("name", slice as string[]);
        (prods || []).forEach((p: any) => {
          const m = Number(p['mrp'] || p['price'] || 0);
          if (p.name) mrpByName[p.name] = m;
        });
      }
    }
    const getItemMrp = (it: any) => {
      const v = Number(it['mrp'] || mrpById[it.product_id] || mrpByName[it.product_name] || it['price'] || 0);
      return v > Number(it['price'] || 0) ? v : Number(it['price'] || 0);
    };

    const fmtDate = (v: any) => v ? new Date(v).toLocaleString("en-IN", { hour12: true }) : "";

    const rows = sourceOrders.map((order) => {
      const shipping = (order.shipping_address as any) || {};
      const items = itemMap[order.id] || [];
      const fullAddress = [order.address, order.city, order.state, order.pincode].filter(Boolean).join(", ");
      const paymentType = order.payment_method === "cod" || order.payment_status === "cod" ? "COD" : "PAID";

      const totalMrp = items.reduce((s: number, it: any) => s + (getItemMrp(it) * Number(it.quantity || 0)), 0);
      const itemsSubtotal = items.reduce((s: number, it: any) => s + Number(it['price'] || 0) * Number(it.quantity || 0), 0);
      const subtotal = Number(order.subtotal || itemsSubtotal);
      const couponDiscount = Number(order.discount || 0);
      const shippingCharge = Number(order.shipping || 0);
      const finalPayable = Number(order.total || 0);
      const mrpDiscount = Math.max(0, totalMrp - itemsSubtotal);
      const totalSavings = mrpDiscount + couponDiscount;

      return {
        "Order ID": order.order_number || order.id,
        "Order Date": fmtDate(order.created_at),
        "Last Updated": fmtDate(order.updated_at),
        "Customer Full Name": order.customer_name || "",
        "Customer Mobile Number": order.customer_phone || "",
        "Alternate Mobile Number": shipping['phone'] || shipping.alternate_phone || shipping['mobile'] || "",
        "Customer Email": order.customer_email || "",
        "Full Address": fullAddress,
        City: order.city || shipping.city || "",
        State: order.state || shipping.state || "",
        Pincode: order.pincode || shipping.postcode || "",
        "Ordered Product Names": items.map((item: any) => item.product_name).join(" | "),
        "Ordered Product Quantities": items.map((item: any) => item.quantity).join(" | "),
        "Ordered Product Amounts": items.map((item: any) => Number(item['price'] || 0) * Number(item.quantity || 0)).join(" | "),
        "Total Items": items.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0),
        "Total MRP": totalMrp,
        Subtotal: subtotal,
        "Coupon Discount": couponDiscount,
        "Shipping Charges": shippingCharge,
        "Total Savings": totalSavings,
        "Final Payable Amount": finalPayable,
        "Order Status": order.status || "",
        "Payment Type (COD / PAID)": paymentType,
        "Payment Status": order.payment_status || "",
        "Payment Method": order.payment_method || "",
        "Payment Transaction ID": order.payment_id || "",
        "Payment Time": order.payment_status === "paid" ? fmtDate(order.updated_at) : "",
        "Tracking ID": order.tracking_id || "",
        "Tracking URL": order.tracking_url || "",
        "Estimated Delivery": order.estimated_delivery || "",
        "Order Notes": order.notes || "",
        "Customer Remark": order.customer_remark || "",
        "Internal Remark": order.internal_remark || "",
        "Cancelled At": fmtDate(order.cancelled_at),
        "Cancelled By": order.cancelled_by || "",
        "Cancellation Reason": order.cancellation_reason || "",
        "Cancellation Reason (Internal)": order.cancellation_reason_internal || "",
      };
    });

    // Per-item breakdown sheet (one row per line item with quantity)
    const itemRows = sourceOrders.flatMap((order) => {
      const items = itemMap[order.id] || [];
      const fullAddress = [order.address, order.city, order.state, order.pincode].filter(Boolean).join(", ");
      return items.map((it: any) => ({
        "Order ID": order.order_number || order.id,
        "Order Date": fmtDate(order.created_at),
        "Customer Name": order.customer_name || "",
        "Mobile": order.customer_phone || "",
        "City": order.city || "",
        "State": order.state || "",
        "Pincode": order.pincode || "",
        "Full Address": fullAddress,
        "Product Name": it.product_name || "",
        "Quantity": Number(it.quantity || 0),
        "Unit Price": Number(it['price'] || 0),
        "MRP": getItemMrp(it),
        "Line Total": Number(it['price'] || 0) * Number(it.quantity || 0),
        "Order Status": order.status || "",
        "Payment Type": order.payment_method === "cod" || order.payment_status === "cod" ? "COD" : "PAID",
      }));
    });

    const sheet = XLSX.utils.json_to_sheet(rows);
    const itemSheet = XLSX.utils.json_to_sheet(itemRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Orders");
    XLSX.utils.book_append_sheet(workbook, itemSheet, "Items");
    const datePart = fromDate || toDate ? `_${fromDate || "all"}_to_${toDate || "all"}` : "";
    XLSX.writeFile(workbook, `orders${datePart}-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: `✅ Exported ${rows.length} order(s), ${itemRows.length} item row(s)` });

  };


  return (
    <div>
      <div className="admin-page-sticky">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Orders ({filteredOrders.length})</h2>
            {importStatus && <p className="mt-1 text-xs text-muted-foreground">{importStatus}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background"
            >
              <option value={10}>10 / page</option>
              <option value={50}>50 / page</option>
              <option value={1000}>1000 / page</option>
            </select>
            {selected.size > 0 && (
              <select onChange={(e) => { bulkUpdateStatus(e.target.value); e.target.value = ""; }}
                className="px-2 py-1.5 border border-primary rounded-lg text-xs bg-background text-primary font-medium">
                <option value="">Bulk Status ({selected.size})</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            )}
            {selected.size > 0 && (
              <button onClick={bulkDelete} className="flex items-center gap-1 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
                <Trash2 className="h-3.5 w-3.5" /> Delete ({selected.size})
              </button>
            )}
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${showFilters ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground hover:bg-secondary'}`}>
              <Filter className="h-3.5 w-3.5" /> Filters
            </button>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
              <Plus className="h-3.5 w-3.5" /> Create Order
            </button>
            <button onClick={handleWPImport} disabled={importing} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${importing ? "animate-spin" : ""}`} /> {importing ? "Importing..." : "Import WP"}
            </button>
            <button onClick={exportOrdersCSV} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="bg-card rounded-xl border border-border p-3 mb-0 flex flex-wrap gap-2 items-center">
            <input placeholder="Search by name, phone, email, order ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-lg text-xs bg-background flex-1 min-w-[150px]" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background">
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)} className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background">
              <option value="all">All Payment</option>
              <option value="unpaid">Unpaid</option>
              <option value="cod">COD</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
            </select>
            <input placeholder="City / District" value={filterCity} onChange={e => setFilterCity(e.target.value)} className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background w-32" />
            <input placeholder="State" value={filterState} onChange={e => setFilterState(e.target.value)} className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background w-28" />
            <div className="flex items-center gap-1">
              <label className="text-[11px] text-muted-foreground">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background" />
              <label className="text-[11px] text-muted-foreground">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background" />
            </div>
            {(filterStatus !== "all" || filterPayment !== "all" || searchQuery || fromDate || toDate || filterCity || filterState) && (
              <button onClick={() => { setFilterStatus("all"); setFilterPayment("all"); setSearchQuery(""); setFromDate(""); setToDate(""); setFilterCity(""); setFilterState(""); }} className="text-xs text-destructive hover:underline flex items-center gap-1">
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        )}
      </div>
      
      {loading ? <p className="text-muted-foreground">Loading...</p> :
      filteredOrders.length === 0 ? <p className="text-muted-foreground">No orders found</p> :
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap px-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={isCurrentPageFullySelected}
              onChange={e => {
                if (e.target.checked) {
                  setSelected(prev => new Set([...prev, ...paginatedOrders.map(o => o.id)]));
                } else {
                  setSelected(prev => {
                    const next = new Set(prev);
                    paginatedOrders.forEach(order => next.delete(order.id));
                    return next;
                  });
                }
              }} />
            Select Page ({paginatedOrders.length})
          </label>
          <button type="button" onClick={() => setSelected(new Set(filteredOrders.map(o => o.id)))}
            className="text-xs font-medium text-primary hover:underline">
            Select All Filtered ({filteredOrders.length})
          </button>
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-destructive hover:underline">
              Clear ({selected.size})
            </button>
          )}
        </div>
        {paginatedOrders.map((o, idx) => (
          <div key={o.id} className={`bg-card rounded-xl border overflow-hidden ${selected.has(o.id) ? 'border-primary' : 'border-border'}`}>
            <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 cursor-pointer hover:bg-muted/30"
              onClick={() => { loadOrderItems(o.id); markViewed(o.id); }}>
              <input type="checkbox" checked={selected.has(o.id)} onClick={e => e.stopPropagation()}
                onChange={() => toggleSel(o.id)} className="shrink-0" />
              <span className="shrink-0 inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded-md bg-muted text-[10px] font-bold text-muted-foreground border border-border">
                #{(safeCurrentPage - 1) * rowsPerPage + idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {(o.status || '').toLowerCase() === 'pending' && (
                    <span title="New pending order" className="inline-flex items-center gap-1 text-[9px] font-bold text-white bg-red-600 px-1.5 py-0.5 rounded-full animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" /> NEW
                    </span>
                  )}
                  <span className="font-mono text-xs sm:text-sm font-extrabold text-primary tracking-wide break-all">{o.order_number || o.id.slice(0,8)}</span>
                  <span className="text-muted-foreground text-xs">—</span>
                  <span className="font-bold text-foreground text-sm sm:text-base">{o.customer_name}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColor(o.status)}`}>{o.status}</span>
                  {(() => {
                    const ps = (o.payment_status || 'unpaid').toLowerCase();
                    const isCod = o.payment_method === 'cod' || ps === 'cod';
                    const isFailed = ps === 'failed';
                    const isPaid = ps === 'paid';
                    const isRefunded = ps === 'refunded';
                    let label = 'UNPAID', cls = 'bg-orange-100 text-orange-800';
                    if (isFailed) { label = 'FAILED'; cls = 'bg-red-100 text-red-800'; }
                    else if (isPaid) { label = 'PAID'; cls = 'bg-emerald-100 text-emerald-900'; }
                    else if (isCod) { label = 'COD'; cls = 'bg-amber-100 text-amber-900'; }
                    else if (isRefunded) { label = 'REFUNDED'; cls = 'bg-purple-100 text-purple-900'; }
                    return <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${cls}`}>{label}</span>;
                  })()}
                </div>

                <div className="flex flex-wrap gap-2 text-sm text-foreground/80">
                  <span className="flex items-center gap-1 font-semibold"><Phone className="h-3.5 w-3.5" />{o.customer_phone}</span>
                  {o.customer_email && <span className="hidden sm:flex items-center gap-1 font-medium"><Mail className="h-3.5 w-3.5" />{o.customer_email}</span>}
                  <span className="font-semibold text-foreground">₹{o.total}</span>
                  <span title="Booking time">📅 {new Date(o.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
                  {o.payment_status === 'paid' && o.updated_at && (
                    <span title="Payment time" className="text-green-700">💳 {new Date(o.updated_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
                  )}
                  {o.payment_id && (
                    <span title="Payment Txn ID" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-900 border border-emerald-200 px-1.5 py-0.5 rounded font-mono select-all break-all">
                      🔖 {o.payment_id}
                    </span>
                  )}
                  {o.payment_method === 'razorpay' && (o.payment_status || '').toLowerCase() !== 'paid' && (
                    <button
                      title="Re-check this order's payment status with Razorpay"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const { data, error } = await supabase.functions.invoke('reconcile-razorpay-order', { body: { order_id: o.id } });
                        if (error || !(data as any)?.ok) {
                          toast({ title: '❌ Reconcile failed', description: (data as any)?.error || error?.message || 'No captured payment found', variant: 'destructive' });
                        } else {
                          toast({ title: '✅ Marked as paid', description: `Txn: ${(data as any).payment_id}` });
                          fetchOrders();
                        }
                      }}
                      className="text-[11px] bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100 px-2 py-0.5 rounded font-semibold">
                      🔄 Verify Payment
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select value={o.status} onClick={e => e.stopPropagation()} onChange={(e) => updateStatus(o.id, e.target.value)}
                  className="text-[11px] px-2 py-1 border border-border rounded-lg bg-background">
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteOrder(o.id, o.order_number || o.id.slice(0,8)); }}
                  title="Delete order"
                  className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition">
                  <Trash2 className="h-4 w-4" />
                </button>
                {expandedOrder === o.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>

            {expandedOrder === o.id && (
              <div className="border-t border-border p-3 sm:p-4 bg-muted/20">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" /> Delivery Details</h4>
                    {editingOrder !== o.id ? (
                      <button onClick={(e) => { e.stopPropagation(); startEditing(o); }} className="text-xs text-primary hover:underline">Edit</button>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); saveOrderEdit(o.id); }} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg flex items-center gap-1 hover:opacity-90">
                        <Save className="h-3 w-3" /> Save
                      </button>
                    )}
                  </div>
                  {editingOrder === o.id ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input placeholder="Phone" value={editForm.customer_phone} onChange={e => setEditForm({...editForm, customer_phone: e.target.value})} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
                      <select value={editForm.payment_status} onChange={e => setEditForm({...editForm, payment_status: e.target.value})} className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
                        <option value="unpaid">Unpaid</option>
                        <option value="cod">COD</option>
                        <option value="paid">Paid</option>
                        <option value="refunded">Refunded</option>
                      </select>
                      <input placeholder="City" value={editForm.city} onChange={e => setEditForm({...editForm, city: e.target.value})} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
                      <input placeholder="Pincode" value={editForm.pincode} onChange={e => setEditForm({...editForm, pincode: e.target.value})} className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
                      <textarea placeholder="Address" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className="md:col-span-2 px-3 py-2 border border-border rounded-lg text-sm bg-background" rows={2} />
                      <textarea placeholder="Notes (legacy)" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="md:col-span-2 px-3 py-2 border border-border rounded-lg text-sm bg-background" rows={1} />
                      <div className="md:col-span-2">
                        <label className="text-[11px] font-semibold text-foreground uppercase tracking-wide block mb-1">📢 Customer Remark <span className="text-muted-foreground normal-case font-normal">(visible to buyer)</span></label>
                        <textarea placeholder="e.g. Your order will be dispatched tomorrow" value={editForm.customer_remark} onChange={e => setEditForm({...editForm, customer_remark: e.target.value})} className="w-full px-3 py-2 border border-primary/40 rounded-lg text-sm bg-background" rows={2} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[11px] font-semibold text-foreground uppercase tracking-wide block mb-1">🔒 Internal Remark <span className="text-muted-foreground normal-case font-normal">(admin only)</span></label>
                        <textarea placeholder="Private staff note" value={editForm.internal_remark} onChange={e => setEditForm({...editForm, internal_remark: e.target.value})} className="w-full px-3 py-2 border border-amber-400/60 rounded-lg text-sm bg-amber-50/40" rows={2} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-foreground font-semibold">{o.customer_name} • {o.customer_phone}</p>
                      {o.customer_email && <p className="text-xs text-muted-foreground">{o.customer_email}</p>}
                      <p className="text-sm text-muted-foreground">{o.address}</p>
                      {(o.city || o.state || o.pincode) && <p className="text-sm text-muted-foreground">{[o.city, o.state, o.pincode].filter(Boolean).join(", ")}</p>}
                      <p className="text-xs mt-1"><span className="text-muted-foreground">Order Type:</span> <span className={`font-bold ${o.payment_method === 'cod' || o.payment_status === 'cod' ? 'text-amber-700' : 'text-emerald-700'}`}>{o.payment_method === 'cod' || o.payment_status === 'cod' ? 'COD (Cash on Delivery)' : 'PAID (Prepaid)'}</span></p>
                      {o.notes && <p className="text-xs text-muted-foreground mt-1 italic">Note: {o.notes}</p>}
                      {o.customer_remark && (
                        <div className="mt-2 bg-primary/5 border border-primary/30 rounded-lg p-2">
                          <p className="text-[10px] uppercase font-semibold text-primary tracking-wide mb-0.5">📢 Customer Remark</p>
                          <p className="text-xs text-foreground whitespace-pre-wrap">{o.customer_remark}</p>
                        </div>
                      )}
                      {o.internal_remark && (
                        <div className="mt-2 bg-amber-50 border border-amber-300 rounded-lg p-2">
                          <p className="text-[10px] uppercase font-semibold text-amber-800 tracking-wide mb-0.5">🔒 Internal Remark</p>
                          <p className="text-xs text-amber-900 whitespace-pre-wrap">{o.internal_remark}</p>
                        </div>
                      )}
                      {o.payment_id && (
                        <p className="text-xs text-foreground mt-2"><span className="text-muted-foreground">Payment Txn ID:</span> <span className="font-mono">{o.payment_id}</span></p>
                      )}
                      {!o.payment_id && o.payment_method !== "cod" && o.payment_status !== "cod" && (
                        <p className="text-xs text-muted-foreground mt-2 italic">No Payment Txn ID recorded</p>
                      )}
                    </>
                  )}
                  {o.status === "cancelled" && o.cancellation_reason && (
                    <div className="mt-2 bg-destructive/10 border border-destructive/30 rounded-lg p-2">
                      <p className="text-xs text-destructive font-semibold">❌ Cancelled by {o.cancelled_by || "system"}</p>
                      <p className="text-xs text-destructive/90 mt-0.5">Reason: {o.cancellation_reason}</p>
                      {o.cancelled_at && <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(o.cancelled_at).toLocaleString("en-IN")}</p>}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-foreground">Products Ordered</h4>
                  <button onClick={async (e) => {
                    e.stopPropagation();
                    const existing = orderItems[o.id] || [];
                    // Detect whether this order uses the order_items table (any non-legacy id)
                    const usesTable = existing.some((it: any) => !String(it.id || "").includes("-j-"));
                    if (usesTable || existing.length === 0) {
                      // Insert real row into order_items so it survives reload
                      const { data: inserted, error } = await supabase.from("order_items").insert({
                        order_id: o.id, product_id: null, product_name: "New Item", quantity: 1, price: 0,
                      }).select().single();
                      if (error || !inserted) {
                        toast({ title: "Add failed", description: error?.message, variant: "destructive" });
                        return;
                      }
                      const updated = [...existing, inserted];
                      setOrderItems(prev => ({ ...prev, [o.id]: updated }));
                      const newTotal = updated.reduce((s: number, i: any) => s + Number(i['price'] || 0) * Number(i.quantity || 0), 0);
                      await supabase.from("orders").update({ total: newTotal }).eq("id", o.id);
                      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, total: newTotal } : x));
                      setEditingItem(inserted.id);
                      setItemForm({ product_name: inserted.product_name, quantity: "1", price: "0", variant: "" });
                    } else {
                      const newItem = {
                        id: `${o.id}-j-${Date.now()}`,
                        order_id: o.id, product_id: null, slug: null,
                        product_name: "New Item", variant: "", quantity: 1, price: 0,
                        _legacyIndex: existing.length,
                      };
                      const updated = [...existing, newItem];
                      setOrderItems(prev => ({ ...prev, [o.id]: updated }));
                      await persistLegacyItems(o.id, updated);
                      setEditingItem(newItem.id);
                      setItemForm({ product_name: newItem.product_name, quantity: "1", price: "0", variant: "" });
                    }
                  }} className="text-[11px] bg-primary text-primary-foreground px-2.5 py-1 rounded-lg font-semibold hover:opacity-90 flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Add Item
                  </button>
                </div>
                {orderItems[o.id]?.length > 0 ? (
                  <div className="space-y-2">
                    {orderItems[o.id].map((item: any) => (
                      <div key={item.id} className="bg-background rounded-lg p-3 border border-border">
                        {editingItem === item.id ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg p-2">
                              <span className="text-[10px] font-semibold uppercase text-primary shrink-0">Pick from catalog</span>
                              <select
                                value=""
                                onChange={e => {
                                  const p = availableProducts.find(x => x.id === e.target.value);
                                  if (!p) return;
                                  setItemForm(f => ({ ...f, product_name: p.name, price: String(p['price']) }));
                                }}
                                className="flex-1 px-2 py-1.5 border border-border rounded-md text-xs bg-background"
                              >
                                <option value="">— Select a product to autofill name &amp; price —</option>
                                {availableProducts.map(p => (
                                  <option key={p.id} value={p.id}>{p.name} (₹{p['price']})</option>
                                ))}
                              </select>
                            </div>
                            <input placeholder="Product Name" value={itemForm.product_name} onChange={e => setItemForm({...itemForm, product_name: e.target.value})}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
                            <input placeholder="Variant / Pack (e.g. Pack of 2, 100ml)" value={(itemForm as any).variant || ""} onChange={e => setItemForm({...itemForm, variant: e.target.value})}
                              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" />
                            <div className="grid grid-cols-2 gap-2">
                              <input placeholder="Qty" type="number" value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})}
                                className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
                              <input placeholder="Price ₹" type="number" value={itemForm['price']} onChange={e => setItemForm({...itemForm, price: e.target.value})}
                                className="px-3 py-2 border border-border rounded-lg text-sm bg-background" />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => saveItemEdit(item.id, o.id)} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg hover:opacity-90">Save</button>
                              <button onClick={() => setEditingItem(null)} className="text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded-lg">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {item.slug ? (
                                <a href={`/product/${item.slug}`} target="_blank" rel="noopener noreferrer"
                                  className="text-sm font-medium text-primary hover:underline break-words">
                                  {item.product_name}
                                </a>
                              ) : (
                                <p className="text-sm font-medium text-foreground break-words">{item.product_name}</p>
                              )}
                              {item.variant && (
                                <span className="inline-block mt-0.5 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{item.variant}</span>
                              )}
                              <p className="text-xs text-muted-foreground mt-0.5">Qty: {item.quantity} × ₹{item['price']}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <p className="text-sm font-bold text-primary">₹{item['price'] * item.quantity}</p>
                              <button onClick={() => startEditingItem(item)} className="p-1 hover:bg-muted rounded"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                              <button onClick={() => deleteItem(item.id, o.id, item.product_name)} className="p-1 hover:bg-destructive/10 rounded"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 border-t border-border">
                      <span className="font-semibold text-sm">Total: <span className="font-bold text-primary">₹{o.total}</span></span>
                      <button onClick={(e) => { e.stopPropagation(); downloadAdminInvoice(o, orderItems[o.id] || []); }}
                        className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
                        <Download className="h-3.5 w-3.5" /> Invoice
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{orderItems[o.id] ? "No items found for this order." : "Loading items..."}</p>
                )}
              </div>
            )}
          </div>
        ))}
        {totalPages > 1 && (
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {(safeCurrentPage - 1) * rowsPerPage + 1}-{Math.min(safeCurrentPage * rowsPerPage, filteredOrders.length)} of {filteredOrders.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-border text-xs bg-background disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-xs text-muted-foreground">Page {safeCurrentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-border text-xs bg-background disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      }
      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchOrders(); }} />}

      {cancelTarget && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setCancelTarget(null)}>
          <div className="bg-card rounded-xl border border-border max-w-lg w-full p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-1">Cancel {cancelTarget.ids.length > 1 ? `${cancelTarget.ids.length} orders` : "order"}</h3>
            <p className="text-xs text-muted-foreground mb-4">Choose a reason. Customer reason is shown to the buyer; internal note stays admin-only.</p>

            <label className="text-xs font-semibold text-foreground block mb-1">📢 Reason (visible to customer)</label>
            <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto pr-1">
              {CANCEL_REASONS.map(r => (
                <label key={r} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 border border-border">
                  <input type="radio" name="cancel-reason" checked={cancelReason === r} onChange={() => setCancelReason(r)} className="mt-0.5" />
                  <span>{r}</span>
                </label>
              ))}
            </div>
            {cancelReason === "Other (specify below)" && (
              <input value={cancelReasonCustom} onChange={e => setCancelReasonCustom(e.target.value)}
                placeholder="Type custom reason for customer..."
                className="w-full mb-3 px-3 py-2 border-2 border-primary/40 rounded-lg text-sm bg-background" />
            )}

            <label className="text-xs font-semibold text-foreground block mb-1">🔒 Internal note (admin only, optional)</label>
            <textarea value={cancelInternal} onChange={e => setCancelInternal(e.target.value)} rows={2}
              placeholder="Private staff note..."
              className="w-full mb-4 px-3 py-2 border border-amber-400/60 rounded-lg text-sm bg-amber-50/40" />

            <div className="flex justify-end gap-2">
              <button onClick={() => setCancelTarget(null)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">Back</button>
              <button onClick={confirmCancel} className="px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90">Confirm Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
