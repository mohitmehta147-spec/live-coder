import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { restoreTrashed, purgeTrashed } from "@/lib/trash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { RotateCcw, Trash2, Search } from "lucide-react";

type TrashedItem = {
  id: string;
  source_table: string;
  original_id: string;
  label: string | null;
  row_data: any;
  deleted_at: string;
  expires_at: string;
};

const TABLE_LABELS: Record<string, string> = {
  products: "Product",
  blogs: "Blog Post",
  profiles: "Customer",
  categories: "Category",
  banners: "Banner",
  testimonials: "Testimonial",
  orders: "Order",
  coupons: "Coupon",
  offers: "Offer",
  announcements: "Announcement",
  media_logos: "Media Logo",
  impact_stats: "Impact Stat",
  product_reviews: "Review",
  contact_inquiries: "Contact Inquiry",
  consultations: "Consultation",
  returns: "Return",
};

const AdminTrash = () => {
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("trashed_items")
      .select("*")
      .order("deleted_at", { ascending: false });
    if (error) {
      toast({ title: "Trash load failed", description: error.message, variant: "destructive" });
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const tables = Array.from(new Set(items.map((i) => i.source_table)));
  const filtered = items.filter((i) => {
    if (filter !== "all" && i.source_table !== filter) return false;
    if (q) {
      const hay = `${i.label || ""} ${i.source_table} ${i.original_id}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const onRestore = async (item: TrashedItem) => {
    setBusy(item.id);
    const { error } = await restoreTrashed(item.id);
    setBusy(null);
    if (error) {
      toast({ title: "Restore failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Restored", description: item.label || item.original_id });
      load();
    }
  };

  const onPurge = async (item: TrashedItem) => {
    if (!confirm(`Permanently delete "${item.label || item.original_id}"? This cannot be undone.`)) return;
    setBusy(item.id);
    const { error } = await purgeTrashed(item.id);
    setBusy(null);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Permanently deleted" });
      load();
    }
  };

  const daysLeft = (expires: string) => {
    const ms = new Date(expires).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Trash</h2>
        <p className="text-sm text-muted-foreground">
          Deleted items are kept here for 30 days. After that they are permanently removed.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search trash..." className="pl-9" />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All types ({items.length})</option>
          {tables.map((t) => (
            <option key={t} value={t}>
              {TABLE_LABELS[t] || t} ({items.filter((i) => i.source_table === t).length})
            </option>
          ))}
        </select>
        <Button variant="outline" onClick={load} disabled={loading}>Refresh</Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg">
          Trash is empty.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Deleted</th>
                <th className="px-4 py-3 font-medium">Auto-delete in</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{i.label || "(no label)"}</div>
                    <div className="text-xs text-muted-foreground">ID: {i.original_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {TABLE_LABELS[i.source_table] || i.source_table}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(i.deleted_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{daysLeft(i.expires_at)} day(s)</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRestore(i)}
                        disabled={busy === i.id}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onPurge(i)}
                        disabled={busy === i.id}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminTrash;
