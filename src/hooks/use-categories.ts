import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Centralized category system.
 * The admin panel (Admin → Categories) is the SINGLE SOURCE OF TRUTH.
 * No component may hardcode category lists — always read from here.
 */
export type Category = {
  id: string;
  name: string;
  name_hi: string | null;
  slug: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  show_in_navbar: boolean | null;
  show_in_concern: boolean | null;
  show_in_shop: boolean | null;
  show_in_filters: boolean | null;
  is_featured: boolean | null;
};

export const CATEGORY_FIELDS =
  "id,name,name_hi,slug,description,icon,image_url,parent_id,sort_order,is_active,show_in_navbar,show_in_concern,show_in_shop,show_in_filters,is_featured";

const ON = (v: unknown) => v !== false && v !== 0 && v !== "0";

export const fetchCategories = async (activeOnly = true): Promise<Category[]> => {
  let query = supabase.from("categories").select(CATEGORY_FIELDS).order("sort_order");
  if (activeOnly) query = query.eq("is_active", true);
  const { data } = await query;
  return ((data as any[]) || []) as Category[];
};

/** All active categories, ordered by the admin-defined display order. */
export const useCategories = (activeOnly = true) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchCategories(activeOnly)
      .then((rows) => alive && setCategories(rows))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [activeOnly]);

  return { categories, loading };
};

export const childrenOf = (all: Category[], parentId: string | null) =>
  all.filter((c) => (c.parent_id || null) === parentId);

/** Top-level categories flagged "Show in Navbar", with their visible children. */
export const navbarTree = (all: Category[]) => {
  const visible = all.filter((c) => ON(c.show_in_navbar));
  return visible
    .filter((c) => !c.parent_id)
    .map((parent) => ({
      parent,
      children: visible
        .filter((c) => c.parent_id === parent.id)
        .map((child) => ({ child, grandChildren: visible.filter((g) => g.parent_id === child.id) })),
    }));
};

/** Categories flagged "Show in Shop By Concern". */
export const concernCategories = (all: Category[]) => all.filter((c) => ON(c.show_in_concern));

/** Categories flagged "Show in Product Filters". */
export const filterCategories = (all: Category[]) => all.filter((c) => ON(c.show_in_filters));

/** Categories flagged "Show in Shop". */
export const shopCategories = (all: Category[]) => all.filter((c) => ON(c.show_in_shop));

/** Featured categories. */
export const featuredCategories = (all: Category[]) => all.filter((c) => ON(c.is_featured));

export const categoryName = (c: Pick<Category, "name" | "name_hi">, lang: string) =>
  lang === "hi" && c.name_hi ? c.name_hi : c.name;

/** Clean, dynamic category URL: /product-category/parent-slug/child-slug */
export const categoryPath = (all: Category[], c: Category): string => {
  const parts: string[] = [c.slug];
  let cur: Category | undefined = c;
  const guard = new Set<string>();
  while (cur?.parent_id && !guard.has(cur.id)) {
    guard.add(cur.id);
    cur = all.find((x) => x.id === cur!.parent_id);
    if (cur) parts.unshift(cur.slug);
  }
  return `/product-category/${parts.join("/")}`;
};
