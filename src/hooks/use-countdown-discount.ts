import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type CountdownDiscount = {
  enabled: boolean;
  percent: number;
  scope: "all" | "category" | "products";
  categoryId: string | null;
  productIds: string[];
  startsAt: string | null;
  endsAt: string | null;
};

const DEFAULT: CountdownDiscount = {
  enabled: false, percent: 0, scope: "all", categoryId: null, productIds: [], startsAt: null, endsAt: null,
};

const KEYS = [
  "countdown_discount_enabled",
  "countdown_discount_percent",
  "countdown_discount_scope",
  "countdown_discount_category_id",
  "countdown_discount_product_ids",
  "countdown_discount_starts_at",
  "countdown_discount_ends_at",
];

let cache: CountdownDiscount | null = null;
let cacheAt = 0;
const TTL = 30_000;

export const resetCountdownDiscountCache = () => { cache = null; cacheAt = 0; };

export const useCountdownDiscount = () => {
  const [cfg, setCfg] = useState<CountdownDiscount>(cache || DEFAULT);

  useEffect(() => {
    const load = async () => {
      if (cache && Date.now() - cacheAt < TTL) { setCfg(cache); return; }
      const { data } = await supabase.from("site_settings").select("key, value").in("key", KEYS);
      const m: Record<string, string> = {};
      (data || []).forEach((d: any) => { m[d.key] = d.value || ""; });
      const next: CountdownDiscount = {
        enabled: m["countdown_discount_enabled"] === "true",
        percent: parseFloat(m["countdown_discount_percent"] || "0") || 0,
        scope: ((m["countdown_discount_scope"] as any) || "all"),
        categoryId: m["countdown_discount_category_id"] || null,
        productIds: (m["countdown_discount_product_ids"] || "").split(",").map(s => s.trim()).filter(Boolean),
        startsAt: m["countdown_discount_starts_at"] || null,
        endsAt: m["countdown_discount_ends_at"] || null,
      };
      cache = next; cacheAt = Date.now();
      setCfg(next);
    };
    load();
  }, []);

  return cfg;
};

export const isDiscountActive = (cfg: CountdownDiscount) => {
  if (!cfg.enabled || cfg.percent <= 0) return false;
  const now = Date.now();
  if (cfg.startsAt && new Date(cfg.startsAt).getTime() > now) return false;
  if (cfg.endsAt && new Date(cfg.endsAt).getTime() < now) return false;
  return true;
};

export const productEligibleForDiscount = (
  cfg: CountdownDiscount,
  product: { id?: string; category_id?: string | null }
) => {
  if (!isDiscountActive(cfg)) return false;
  if (cfg.scope === "all") return true;
  if (cfg.scope === "category") return !!product.category_id && product.category_id === cfg.categoryId;
  if (cfg.scope === "products") return !!product.id && cfg.productIds.includes(product.id);
  return false;
};

/** Apply countdown discount to a product price. Returns effective sale price. */
export const applyCountdownDiscount = (
  cfg: CountdownDiscount,
  product: { id?: string; category_id?: string | null; price: number },
  basePrice?: number
) => {
  const base = basePrice ?? product.price;
  if (!productEligibleForDiscount(cfg, product)) return base;
  return Math.round(base * (1 - cfg.percent / 100));
};
