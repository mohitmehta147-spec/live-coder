import { Search, ShoppingBag, Menu, X, PackageSearch, MapPinned, UserRound, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import MegaMenu from "./MegaMenu";
import MobileMenu from "./MobileMenu";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/lib/supabase";
import logo from "@/assets/logo.png";

const SiteHeader = () => {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const { t, lang } = useLanguage();
  const { totalItems, setIsOpen } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) { setSearchResults([]); setShowResults(false); return; }
    const { data } = await supabase.from("products").select("id, name, name_hi, slug, price, image_url").ilike("name", `%${query}%`).eq("is_active", true).limit(8);
    setSearchResults(data || []);
    setShowResults(true);
  };

  const goToProduct = (slug: string) => {
    setShowResults(false); setSearchQuery("");
    navigate({ to: "/product/$slug", params: { slug } });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-card shadow-sm">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-2 md:gap-4">
          <button className="lg:hidden text-foreground" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="VedicUpchar Logo" className="w-10 h-10 rounded-lg object-contain" />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-primary leading-tight tracking-tight">VedicUpchar</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {lang === "hi" ? (
                  <>
                    <span className="text-sm font-bold text-primary">भारत</span>
                    {" का सबसे भरोसेमंद आयुर्वेदिक ब्रांड"}
                  </>
                ) : (
                  <>
                    <span className="text-sm font-bold text-primary">INDIA's</span>
                    {" Most Trusted Ayurvedic Brand"}
                  </>
                )}
              </p>

            </div>
          </Link>

          <LanguageSwitcher />

          <div className="hidden md:flex flex-1 max-w-xl relative">
            <div className="relative w-full">
              <label htmlFor="desktop-search" className="sr-only">Search products</label>
              <input id="desktop-search" type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)} onFocus={() => searchResults.length > 0 && setShowResults(true)} onBlur={() => setTimeout(() => setShowResults(false), 200)}
                placeholder={t("Search medicines, health problems...", "दवाइयाँ, स्वास्थ्य समस्या खोजें...")}
                className="w-full pl-4 pr-12 py-2.5 border-2 border-primary/30 rounded-full bg-background text-sm focus:outline-none focus:border-primary transition" />
              <button className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:opacity-90 transition" aria-label="Search">
                <Search className="h-4 w-4" />
              </button>
            </div>
            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
                {searchResults.map(p => (
                  <button key={p.id} onClick={() => goToProduct(p.slug)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition text-left">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded object-cover" loading="lazy" /> : <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">🌿</div>}
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-primary font-bold">₹{p['price']}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 md:gap-2">
            <button
              onClick={() => setMobileSearchOpen(v => !v)}
              className="md:hidden flex items-center justify-center h-10 w-10 rounded-full border border-primary/15 bg-linear-to-br from-background to-primary/5 text-foreground hover:text-primary hover:border-primary/40 transition-all"
              aria-label={t("Open search", "खोज खोलें")}
              title={t("Search", "खोज")}
            >
              {mobileSearchOpen ? <X className="h-[18px] w-[18px]" /> : <Search className="h-[18px] w-[18px]" strokeWidth={1.75} />}
            </button>
            <button
              onClick={() => setIsOpen(true)}
              className="relative flex items-center justify-center h-10 w-10 rounded-full border border-primary/15 bg-linear-to-br from-background to-primary/5 text-foreground hover:text-primary hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 transition-all"
              aria-label="Cart"
            >
              <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-cta text-cta-foreground text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-bold ring-2 ring-card shadow-sm">{totalItems}</span>
              )}
            </button>
            {session ? (
              <div className="flex items-center gap-1.5">
                <Link to="/my-profile" className="flex items-center justify-center h-10 w-10 rounded-full border border-primary/15 bg-linear-to-br from-background to-primary/5 text-foreground hover:text-primary hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 transition-all" aria-label="My Account" title={t("My Account", "मेरा अकाउंट")}>
                  <UserRound className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </Link>
                <button onClick={handleLogout} className="flex items-center justify-center h-10 w-10 rounded-full border border-destructive/30 bg-linear-to-br from-background to-destructive/5 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all" aria-label="Logout" title={t("Logout", "लॉगआउट")}>
                  <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </button>
              </div>
            ) : (
              <Link to="/auth" className="flex items-center justify-center h-10 w-10 rounded-full border border-primary/15 bg-linear-to-br from-background to-primary/5 text-foreground hover:text-primary hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 transition-all" aria-label="Login">
                <UserRound className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </Link>
            )}
          </div>
        </div>

        {/* Mobile search — opens via toggle button */}
        {mobileSearchOpen && (
          <div className="md:hidden px-4 pb-3 relative animate-fade-in">
            <div className="relative">
              <label htmlFor="mobile-search" className="sr-only">Search products</label>
              <input id="mobile-search" autoFocus type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)} onBlur={() => setTimeout(() => setShowResults(false), 200)}
                placeholder={t("Search medicines, health problems...", "दवाइयाँ, स्वास्थ्य समस्या खोजें...")}
                className="w-full pl-4 pr-12 py-2.5 border-2 border-primary/30 rounded-full bg-background text-sm focus:outline-none focus:border-primary" />
              <button className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 bg-primary text-primary-foreground rounded-full flex items-center justify-center" aria-label="Search">
                <Search className="h-4 w-4" />
              </button>
            </div>
            {showResults && searchResults.length > 0 && (
              <div className="absolute left-4 right-4 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                {searchResults.map(p => (
                  <button key={p.id} onClick={() => { goToProduct(p.slug); setMobileSearchOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition text-left">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded object-cover" loading="lazy" /> : <span>🌿</span>}
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-primary font-bold">₹{p['price']}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <nav className="hidden lg:block" aria-label="Main navigation"><MegaMenu /></nav>
      {mobileMenuOpen && <MobileMenu onClose={() => setMobileMenuOpen(false)} />}
    </header>
  );
};

export default SiteHeader;