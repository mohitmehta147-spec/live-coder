import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { trashDelete } from "@/lib/trash";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, FileText, Music, Video, Image, Filter, X, Download, Trash2 } from "lucide-react";

const asArray = (v: any): string[] => {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    try { const p = JSON.parse(v); if (Array.isArray(p)) return p.filter(Boolean); } catch {}
    return v.replace(/^\{|\}$/g, "").split(",").map(s => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
  }
  return [];
};

const fileIcon = (url: string) => {
  const lower = url.toLowerCase();
  if (lower.includes("video") || lower.match(/\.(mp4|mov|avi|webm)/)) return <Video className="h-3.5 w-3.5" />;
  if (lower.includes("audio") || lower.match(/\.(mp3|wav|m4a|ogg)/)) return <Music className="h-3.5 w-3.5" />;
  if (lower.includes("pdf") || lower.match(/\.pdf/)) return <FileText className="h-3.5 w-3.5" />;
  return <Image className="h-3.5 w-3.5" />;
};

const AdminConsultations = () => {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const { toast } = useToast();

  const fetchAll = async () => {
    const { data } = await supabase.from("consultations").select("*").order("created_at", { ascending: false });
    setConsultations(data || []);
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  const normalizeStatus = (s: string | null | undefined) => {
    const v = (s || "pending").toLowerCase();
    if (v === "pending") return "new";
    return v;
  };
  const filteredConsultations = consultations.filter(c => {
    if (filterStatus !== "all" && normalizeStatus(c.status) !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return c.patient_name?.toLowerCase().includes(q) || c['mobile']?.includes(q) || c.city?.toLowerCase().includes(q) || c.disease?.toLowerCase().includes(q);
    }
    return true;
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("consultations").update({ status }).eq("id", id);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    setConsultations(consultations.map((c) => c.id === id ? { ...c, status } : c));
    toast({ title: "✅ Status updated to " + status });
  };

  const fmtDateTime = (c: any) => {
    if (c.consultation_date) return { d: c.consultation_date, t: c.consultation_time || "" };
    if (c.created_at) {
      const dt = new Date(c.created_at);
      return {
        d: dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        t: dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
      };
    }
    return { d: "", t: "" };
  };

  const exportCSV = () => {
    if (filteredConsultations.length === 0) { toast({ title: "No consultations to export", variant: "destructive" }); return; }
    const headers = ["Patient Name", "Mobile", "Gender", "Age", "City", "Disease", "Type", "Date", "Time", "Status", "Files", "Created At"];
    const rows = filteredConsultations.map(c => {
      const { d, t } = fmtDateTime(c);
      return [
        c.patient_name || "", c['mobile'] || "", c.gender || "", c.age || "",
        c.city || "", c.disease || "", c.consultation_type || "",
        d, t, normalizeStatus(c.status),
        asArray(c.file_urls).join(" | "),
        c.created_at ? new Date(c.created_at).toLocaleString() : "",
      ];
    });
    const escape = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `consultations_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: `✅ Exported ${filteredConsultations.length} consultations` });
  };

  const toggle = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const allChecked = filteredConsultations.length > 0 && filteredConsultations.every(c => selected.has(c.id));
  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(filteredConsultations.map(c => c.id)));
  };

  const runBulkStatus = async () => {
    if (!bulkStatus || selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("consultations").update({ status: bulkStatus }).in("id", ids);
    if (error) { toast({ title: "Bulk update failed", description: error.message, variant: "destructive" }); return; }
    setConsultations(prev => prev.map(c => ids.includes(c.id) ? { ...c, status: bulkStatus } : c));
    toast({ title: `✅ Updated ${ids.length} consultations` });
    setSelected(new Set()); setBulkStatus("");
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} consultation(s)? They will be moved to Trash.`)) return;
    const ids = Array.from(selected);
    for (const id of ids) {
      const row = consultations.find(c => c.id === id);
      try { await trashDelete("consultations", id, row); } catch {}
    }
    setConsultations(prev => prev.filter(c => !ids.includes(c.id)));
    setSelected(new Set());
    toast({ title: `🗑️ Deleted ${ids.length} consultation(s)` });
  };

  const deleteOne = async (c: any) => {
    if (!confirm("Delete this consultation?")) return;
    try { await trashDelete("consultations", c.id, c); } catch {}
    setConsultations(prev => prev.filter(x => x.id !== c.id));
  };

  return (
    <div>
      <div className="sticky top-0 z-30 bg-background -mx-3 sm:mx-0 px-3 sm:px-0 pt-2 pb-3 border-b border-border mb-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Consultations ({filteredConsultations.length})</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border bg-card border-border text-foreground hover:bg-secondary transition">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${showFilters ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground hover:bg-secondary'}`}>
              <Filter className="h-3.5 w-3.5" /> Filters
            </button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="bg-primary/5 border border-primary/30 rounded-xl p-3 mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{selected.size} selected</span>
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background">
              <option value="">Change status to...</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button onClick={runBulkStatus} disabled={!bulkStatus} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40">Apply</button>
            <button onClick={deleteSelected} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-destructive text-destructive-foreground hover:opacity-90 flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Delete Selected</button>
            <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted">Clear</button>
          </div>
        )}

        {showFilters && (
          <div className="bg-card rounded-xl border border-border p-3 mb-2 flex flex-wrap gap-2 items-center">
            <input placeholder="Search name, mobile, city, disease..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-lg text-xs bg-background flex-1 min-w-[150px]" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background">
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {(filterStatus !== "all" || searchQuery) && (
              <button onClick={() => { setFilterStatus("all"); setSearchQuery(""); }} className="text-xs text-destructive hover:underline flex items-center gap-1">
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="px-2 py-3 w-8"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
            <th className="text-left px-2 py-3 font-medium text-muted-foreground w-10">#</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Patient</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Mobile</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden sm:table-cell">Gender</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden sm:table-cell">Age</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden md:table-cell">City</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Disease</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden lg:table-cell">Type</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden lg:table-cell">Date/Time</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden sm:table-cell">Files</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Status</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground"></th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={13} className="text-center py-8 text-muted-foreground">Loading...</td></tr> :
            filteredConsultations.length === 0 ? <tr><td colSpan={13} className="text-center py-8 text-muted-foreground">No consultations found</td></tr> :
            filteredConsultations.map((c, idx) => {
              const { d, t } = fmtDateTime(c);
              return (
              <tr key={c.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-2 py-3"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                <td className="px-2 py-3 text-xs font-semibold text-muted-foreground">{idx + 1}</td>
                <td className="px-3 py-3 font-medium text-xs sm:text-sm">{c.patient_name}</td>
                <td className="px-3 py-3 text-xs">{c['mobile']}</td>
                <td className="px-3 py-3 capitalize text-xs hidden sm:table-cell">{c.gender || "-"}</td>
                <td className="px-3 py-3 text-xs hidden sm:table-cell">{c.age || "-"}</td>
                <td className="px-3 py-3 text-xs hidden md:table-cell">{c.city || "-"}</td>
                <td className="px-3 py-3 text-xs">{c.disease || "-"}</td>
                <td className="px-3 py-3 text-xs hidden lg:table-cell">{c.consultation_type || "-"}</td>
                <td className="px-3 py-3 text-xs hidden lg:table-cell">
                  <span className="font-medium">{d}</span><br/>
                  <span className="text-muted-foreground">{t}</span>
                </td>
                <td className="px-3 py-3 hidden sm:table-cell">
                  {asArray(c.file_urls).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {asArray(c.file_urls).map((url: string, i: number) => (
                        <button key={i} type="button"
                          onClick={async () => {
                            const m = url.match(/consultation-files\/([^?#]+)/);
                            const path = m ? m[1] : url;
                            const { data } = await supabase.storage.from("consultation-files").createSignedUrl(path, 300);
                            if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                          }}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline bg-primary/10 rounded px-1.5 py-0.5">
                          {fileIcon(url)}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      ))}
                    </div>
                  ) : "-"}
                </td>
                <td className="px-3 py-3">
                  <select value={normalizeStatus(c.status)} onChange={(e) => updateStatus(c.id, e.target.value)} className="text-[11px] px-2 py-1 border border-border rounded bg-background">
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="px-3 py-3">
                  <button onClick={() => deleteOne(c)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminConsultations;
