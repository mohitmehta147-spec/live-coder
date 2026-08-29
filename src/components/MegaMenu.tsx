import { ChevronDown } from "lucide-react";
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCategories, navbarTree, categoryName } from "@/hooks/use-categories";

/**
 * Navbar is fully admin controlled (Admin → Categories).
 * A category appears here only when Active = ON and "Show in Navbar" = ON.
 * Ordering comes from the admin display order (drag & drop).
 *
 * Desktop rule: only TOP-LEVEL categories sit on the bar; sub / child
 * categories live inside the mega-menu dropdown. To avoid horizontal
 * overflow, extra top-level categories collapse into a "More ▼" menu.
 */
const MAX_TOP_LEVEL = 6;

type Tree = ReturnType<typeof navbarTree>;

const MegaMenu = () => {
  const { categories } = useCategories();
  const { t, lang } = useLanguage();

  const tree = useMemo(() => navbarTree(categories), [categories]);
  const visible: Tree = tree.slice(0, MAX_TOP_LEVEL);
  const overflow: Tree = tree.slice(MAX_TOP_LEVEL);

  const renderMega = (children: Tree[number]["children"]) => (
    <div className="fixed left-0 right-0 bg-card shadow-2xl border-t-2 border-primary z-50 hidden group-hover:block">
      <div className="container mx-auto px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          {children.map(({ child, grandChildren }) => (
            <div key={child.id}>
              <Link
                to="/products" search={{ category: child.slug }}
                className="text-xs font-bold text-foreground tracking-wider uppercase mb-4 pb-2 border-b border-border block hover:text-primary transition-colors"
              >
                {categoryName(child, lang)}
              </Link>
              {grandChildren.length > 0 && (
                <ul className="space-y-2.5">
                  {grandChildren.map((g) => (
                    <li key={g.id}>
                      <Link to="/products" search={{ category: g.slug }} className="text-sm text-muted-foreground hover:text-primary transition-colors block leading-snug">
                        {categoryName(g, lang)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <nav className="bg-primary">
      <div className="container mx-auto px-4">
        <ul className="flex items-center flex-nowrap">
          <li>
            <Link to="/" className="flex items-center px-3 py-3 text-sm font-medium text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors whitespace-nowrap">
              {t("Home", "होम")}
            </Link>
          </li>

          {visible.map(({ parent, children }) => (
            <li key={parent.id} className="relative group min-w-0">
              <Link
                to="/products" search={{ category: parent.slug }}
                className="flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap max-w-[190px] truncate text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10 group-hover:bg-card group-hover:text-foreground"
              >
                <span className="truncate">{categoryName(parent, lang)}</span>
                {children.length > 0 && <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:rotate-180" />}
              </Link>
              {children.length > 0 && renderMega(children)}
            </li>
          ))}

          {overflow.length > 0 && (
            <li className="relative group">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10 group-hover:bg-card group-hover:text-foreground"
              >
                {t("More", "और")}
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
              </button>
              <div className="absolute left-0 top-full min-w-[240px] bg-card shadow-2xl border-t-2 border-primary z-50 hidden group-hover:block py-2">
                {overflow.map(({ parent, children }) => (
                  <div key={parent.id} className="px-4 py-1.5">
                    <Link to="/products" search={{ category: parent.slug }} className="text-sm font-semibold text-foreground hover:text-primary transition-colors block">
                      {categoryName(parent, lang)}
                    </Link>
                    {children.length > 0 && (
                      <ul className="mt-1 space-y-1 pl-3 border-l border-border">
                        {children.map(({ child }) => (
                          <li key={child.id}>
                            <Link to="/products" search={{ category: child.slug }} className="text-xs text-muted-foreground hover:text-primary transition-colors block">
                              {categoryName(child, lang)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </li>
          )}

          {[
            { to: "/products", label: t("Shop", "शॉप") },
            { to: "/blog", label: t("Blog", "ब्लॉग") },
            { to: "/contact", label: t("Contact Us", "संपर्क करें") },
            { to: "/consultation", label: t("Doctor Consultation", "डॉक्टर परामर्श") },
          ].map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="flex items-center px-3 py-3 text-sm font-medium text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors whitespace-nowrap">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default MegaMenu;
