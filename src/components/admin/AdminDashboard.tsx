import { memo, useMemo, useState, useEffect, type ComponentType } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, Activity, Package, FolderOpen, ShoppingCart, Settings, Image, Stethoscope, LogOut, Tag, Palette, FileText, Key, Menu, X, Ticket, ArrowLeft, Newspaper, BarChart3, Shield, Share2, RotateCcw, MessageSquare, Truck, Users, Timer, Star, Quote, TrendingUp, AlertTriangle, Mail, Megaphone, Trash2, Inbox, Sparkles, Film, Search, Pin } from "lucide-react";
import logo from "@/assets/logo.png";
import AdminProducts from "./AdminProducts";
import AdminCategories from "./AdminCategories";
import AdminOrders from "./AdminOrders";
import AdminSettings from "./AdminSettings";
import AdminBanners from "./AdminBanners";
import AdminConsultations from "./AdminConsultations";
import AdminOverview from "./AdminOverview";
import AdminOffers from "./AdminOffers";
import AdminColorSettings from "./AdminColorSettings";
import AdminBlogs from "./AdminBlogs";
import AdminCredentials from "./AdminCredentials";
import AdminCoupons from "./AdminCoupons";
import AdminMediaLogos from "./AdminMediaLogos";
import AdminImpactStats from "./AdminImpactStats";
import AdminTrustBadges from "./AdminTrustBadges";
import AdminSocialLinks from "./AdminSocialLinks";
import AdminReturns from "./AdminReturns";
import AdminContactInquiries from "./AdminContactInquiries";
import AdminContact from "./AdminContact";
import AdminDeliverySettings from "./AdminDeliverySettings";
import AdminCustomers from "./AdminCustomers";
import AdminCountdown from "./AdminCountdown";
import AdminConsultationSlots from "./AdminConsultationSlots";
import AdminReviews from "./AdminReviews";
import AdminTestimonials from "./AdminTestimonials";
import AdminAnalytics from "./AdminAnalytics";
import AdminLowStock from "./AdminLowStock";
import AdminNewsletter from "./AdminNewsletter";
import AdminAnnouncements from "./AdminAnnouncements";
import AdminTrash from "./AdminTrash";
import AdminLeads from "./AdminLeads";
import AdminConsultationBanner from "./AdminConsultationBanner";
import AdminConsultationDiseases from "./AdminConsultationDiseases";
import AdminConsultationTypes from "./AdminConsultationTypes";
import AdminTopSelling from "./AdminTopSelling";
import AdminReels from "./AdminReels";
import AdminHealth from "./AdminHealth";

const tabs = [
  // Fixed top order (requested)
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "leads", label: "All Leads", icon: Inbox },
  { id: "consultations", label: "Consultations", icon: Stethoscope },
  { id: "contacts", label: "Contact Inquiries", icon: MessageSquare },
  { id: "blogs", label: "Blog Posts", icon: FileText },
  { id: "coupons", label: "Offers & Coupons", icon: Ticket },
  { id: "countdown", label: "Countdown Sale", icon: Timer },
  // Rest below
  { id: "analytics", label: "Sales Analytics", icon: TrendingUp },
  { id: "products", label: "Products", icon: Package },
  { id: "top-selling", label: "Top Selling Section", icon: TrendingUp },
  { id: "low-stock", label: "Low Stock Alerts", icon: AlertTriangle },
  { id: "categories", label: "Categories", icon: FolderOpen },
  { id: "customers", label: "Customers", icon: Users },
  { id: "reviews", label: "Product Reviews", icon: Star },
  { id: "testimonials", label: "Testimonials", icon: Quote },
  { id: "announcements", label: "Announcement Bar", icon: Megaphone },
  { id: "banners", label: "Banners", icon: Image },
  { id: "reels", label: "Reels & Shorts", icon: Film },
  { id: "newsletter", label: "Newsletter", icon: Mail },
  { id: "media", label: "Media Logos", icon: Newspaper },
  { id: "impact", label: "Impact Stats", icon: BarChart3 },
  { id: "trust", label: "Trust Badges", icon: Shield },
  { id: "social", label: "Social Links", icon: Share2 },
  { id: "consultation-slots", label: "Consultation Slots", icon: Timer },
  { id: "consultation-banner", label: "Consultation Banner", icon: Sparkles },
  { id: "consultation-diseases", label: "Consultation Diseases", icon: Stethoscope },
  { id: "consultation-types", label: "Consultation Types", icon: Stethoscope },
  { id: "contact-page", label: "Contact Us Page", icon: MessageSquare },
  { id: "returns", label: "Returns", icon: RotateCcw },
  { id: "delivery", label: "Delivery Settings", icon: Truck },
  { id: "colors", label: "Colors & Theme", icon: Palette },
  { id: "credentials", label: "API Credentials", icon: Key },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "trash", label: "Trash", icon: Trash2 },
  { id: "health", label: "API Health", icon: Activity },
];

const tabComponents: Record<string, ComponentType<any>> = {
  overview: AdminOverview,
  analytics: AdminAnalytics,
  products: AdminProducts,
  "top-selling": AdminTopSelling,
  "low-stock": AdminLowStock,
  categories: AdminCategories,
  orders: AdminOrders,
  customers: AdminCustomers,
  reviews: AdminReviews,
  testimonials: AdminTestimonials,
  coupons: AdminCoupons,
  countdown: AdminCountdown,
  announcements: AdminAnnouncements,
  banners: AdminBanners,
  reels: AdminReels,
  blogs: AdminBlogs,
  newsletter: AdminNewsletter,
  media: AdminMediaLogos,
  impact: AdminImpactStats,
  trust: AdminTrustBadges,
  social: AdminSocialLinks,
  consultations: AdminConsultations,
  "consultation-slots": AdminConsultationSlots,
  "consultation-banner": AdminConsultationBanner,
  "consultation-diseases": AdminConsultationDiseases,
  "consultation-types": AdminConsultationTypes,
  leads: AdminLeads,
  returns: AdminReturns,
  contacts: AdminContactInquiries,
  "contact-page": AdminContact,
  delivery: AdminDeliverySettings,
  colors: AdminColorSettings,
  credentials: AdminCredentials,
  settings: AdminSettings,
  trash: AdminTrash,
  health: AdminHealth,
};

const AdminTabPanel = memo(({ activeTab, onNavigate }: { activeTab: string; onNavigate: (tabId: string) => void }) => {
  const ActiveComponent = tabComponents[activeTab] || AdminOverview;

  if (activeTab === "overview") {
    return <AdminOverview onNavigate={onNavigate} />;
  }

  return <ActiveComponent />;
});
AdminTabPanel.displayName = "AdminTabPanel";

const AdminDashboard = ({ session }: { session: any }) => {
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return "overview";
    return sessionStorage.getItem("admin_active_tab") || "overview";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [counts, setCounts] = useState<{ orders: number; consultations: number; contacts: number; reviews: number; leads: number }>({ orders: 0, consultations: 0, contacts: 0, reviews: 0, leads: 0 });
  const [search, setSearch] = useState("");
  const [usage, setUsage] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("admin_tab_usage") || "{}"); } catch { return {}; }
  });
  const navigate = useNavigate();
  const activeLabel = tabs.find(t => t.id === activeTab)?.label || "Dashboard";
  const sidebarTabs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? tabs.filter(t => t.label.toLowerCase().includes(q) || t.id.includes(q)) : tabs;
    // Top 5 most-used pinned on top
    const topIds = Object.entries(usage).sort((a, b) => b[1] - a[1]).slice(0, 5).filter(([, v]) => v > 0).map(([k]) => k);
    if (q || topIds.length === 0) return { pinned: [] as typeof tabs, rest: filtered };
    const pinned = topIds.map(id => tabs.find(t => t.id === id)).filter(Boolean) as typeof tabs;
    const rest = filtered.filter(t => !topIds.includes(t.id));
    return { pinned, rest };
  }, [search, usage]);

  const loadCounts = async () => {
    try {
      const [o, c, ci, r] = await Promise.all([
        (supabase as any).from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
        (supabase as any).from("consultations").select("id", { count: "exact", head: true }).eq("status", "pending"),
        (supabase as any).from("contact_inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
        (supabase as any).from("product_reviews").select("id", { count: "exact", head: true }).neq("status", "approved"),
      ]);
      const leadsTotal = (c.count || 0) + (ci.count || 0);
      setCounts({ orders: o.count || 0, consultations: c.count || 0, contacts: ci.count || 0, reviews: r.count || 0, leads: leadsTotal });
    } catch {}
  };

  useEffect(() => {
    loadCounts();
    const id = setInterval(loadCounts, 30000);
    return () => clearInterval(id);
  }, [activeTab]);

  const badgeFor = (id: string) => {
    if (id === "orders") return counts.orders;
    if (id === "consultations") return counts.consultations;
    if (id === "contacts") return counts.contacts;
    if (id === "reviews") return counts.reviews;
    if (id === "leads") return counts.leads;
    return 0;
  };

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    try { sessionStorage.setItem("admin_active_tab", id); } catch {}
    try { sessionStorage.setItem("admin_visited_tabs", JSON.stringify([id])); } catch {}
    setUsage(prev => {
      const next = { ...prev, [id]: (prev[id] || 0) + 1 };
      try { localStorage.setItem("admin_tab_usage", JSON.stringify(next)); } catch {}
      return next;
    });
    setSidebarOpen(false);
  };

  const renderTab = (tab: typeof tabs[number], pinned = false) => {
    const Icon = tab.icon;
    const badge = badgeFor(tab.id);
    return (
      <button key={tab.id} onClick={() => handleTabClick(tab.id)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
          activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
        }`}>
        <Icon className="h-4 w-4" />
        <span className="flex-1 text-left truncate">{tab.label}</span>
        {pinned && <Pin className="h-3 w-3 opacity-60" />}
        {badge > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-red-600 text-white animate-pulse shadow">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-muted">
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 bg-card border-b border-border flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-muted transition">
            <Menu className="h-5 w-5" />
          </button>
          <button onClick={() => navigate({ to: "/" })} className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground" title="Back to Site">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <img loading="lazy" decoding="async" src={logo} alt="Logo" className="w-7 h-7 rounded object-contain" />
          <span className="font-bold text-primary text-sm">Admin</span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">{activeLabel}</span>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed md:sticky top-0 left-0 z-50 md:z-auto
          h-screen w-64 md:w-60 bg-card border-r border-border
          flex flex-col shrink-0
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img loading="lazy" decoding="async" src={logo} alt="VedicUpchar" className="w-8 h-8 rounded-lg object-contain" />
              <div>
                <p className="font-bold text-primary text-base leading-tight">VedicUpchar</p>
                <p className="text-[10px] text-muted-foreground">Admin Panel</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 rounded-lg hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-2 pt-2 space-y-2">
            <button onClick={() => navigate({ to: "/" })}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition">
              <ArrowLeft className="h-4 w-4" />
              Back to Site
            </button>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu..."
                className="w-full pl-8 pr-2 py-2 text-sm rounded-lg bg-secondary border border-transparent focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {sidebarTabs.pinned.length > 0 && (
              <>
                <p className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Frequently used</p>
                {sidebarTabs.pinned.map(t => renderTab(t, true))}
                <div className="my-1.5 border-t border-border" />
              </>
            )}
            {sidebarTabs.rest.map(t => renderTab(t))}
            {sidebarTabs.rest.length === 0 && sidebarTabs.pinned.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No matches</p>
            )}
          </nav>
          <div className="p-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2 truncate">{session.user?.email}</p>
            <button onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition">
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="admin-main flex-1 p-4 md:p-6 overflow-x-auto min-w-0">
          <AdminTabPanel activeTab={activeTab} onNavigate={handleTabClick} />
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
