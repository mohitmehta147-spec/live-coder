/**
 * Dynamic pack-size system.
 * Total quantity is ALWAYS derived: base pack size × pack quantity.
 *   200 GM base → Pack of 1 = 200 GM, Pack of 2 = 400 GM, Pack of 3 = 600 GM
 * Nothing stores 400/600 manually.
 */

export type VariationLike = {
  label?: string;
  price?: number;
  mrp?: number;
  quantity?: number;
  pack_qty?: number;
  size?: string;
  per_unit?: string;
  [k: string]: any;
};

/** "Pack of 3", "3 Pack", "Combo Pack of 2" → 3 / 3 / 2. Defaults to 1. */
export const parsePackCount = (label?: string): number => {
  if (!label) return 1;
  const m =
    label.match(/pack\s*of\s*(\d+)/i) ||
    label.match(/(\d+)\s*(?:x|×)\s*pack/i) ||
    label.match(/(\d+)\s*pack/i);
  const n = m ? parseInt(m[1], 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
};

const UNIT_LABEL: Record<string, string> = {
  gm: "GM", g: "GM", mg: "MG", kg: "KG",
  ml: "ML", l: "L", ltr: "L",
  cap: "CAP", capsule: "CAP", capsules: "CAP",
  tab: "TAB", tablet: "TAB", tablets: "TAB",
  piece: "Piece", pcs: "Piece",
};

export const unitLabel = (unit?: string) => {
  const u = String(unit || "").toLowerCase().trim();
  return UNIT_LABEL[u] || (u ? u.toUpperCase() : "");
};

/** 1000 GM → "1 KG", 1500 ML → "1.5 L", else "400 GM". */
export const formatQuantity = (qty: number, unit?: string): string => {
  if (!qty || qty <= 0) return "";
  const u = String(unit || "").toLowerCase().trim();
  if ((u === "gm" || u === "g") && qty >= 1000) return `${+(qty / 1000).toFixed(2)} KG`;
  if ((u === "ml") && qty >= 1000) return `${+(qty / 1000).toFixed(2)} L`;
  const label = unitLabel(u);
  return label ? `${+qty.toFixed(2)} ${label}` : `${+qty.toFixed(2)}`;
};

/** Price per single base unit, e.g. "₹3.45/GM". */
export const perUnitLabel = (price: number, qty: number, unit?: string): string => {
  if (!price || !qty || qty <= 0) return "";
  const raw = price / qty;
  // Whole rupees for readable rates (₹524.5 → ₹525); keep 2 decimals only for tiny rates.
  const rate = raw >= 10 ? Math.round(raw) : +raw.toFixed(2);
  const label = unitLabel(unit) || "unit";
  return `₹${rate}/${label}`;
};

/**
 * Enrich a variation with the derived total quantity / size / per-unit label.
 * Explicit `quantity` on the variation always wins; otherwise it's computed
 * from the product's base pack size × the pack count in the label.
 */
export const withPackInfo = (
  v: VariationLike,
  basePackSize?: number | string | null,
  unit?: string | null,
): VariationLike => {
  const packQty = Number(v.pack_qty) || parsePackCount(v.label);
  const explicit = Number(v.quantity) || 0;
  // If no base pack size is set, derive it from the stored total: 1000 ML / Pack of 2 = 500 ML.
  const base = Number(basePackSize) || (explicit > 0 && packQty > 0 ? explicit / packQty : 0);
  const qty = explicit || (base > 0 ? base * packQty : 0);
  if (!qty) return v;
  return {
    ...v,
    pack_qty: packQty,
    quantity: qty,
    size: formatPackSize(base, unit, packQty) || v.size,
    per_unit: perUnitLabel(Number(v.price) || 0, qty, unit || undefined) || v.per_unit,
  };
};

/** Display as "120 GM × 2 = 240 GM" (base pack size x pack count = total). */
export const formatPackSize = (
  base: number,
  unit?: string | null,
  packQty: number = 1,
): string => {
  const b = formatQuantity(Number(base) || 0, unit || undefined);
  if (!b) return "";
  const n = Math.max(1, Math.round(packQty) || 1);
  if (n === 1) return b;
  const total = formatQuantity((Number(base) || 0) * n, unit || undefined);
  return `${b} × ${n} = ${total}`;
};

export const withPackInfoAll = (
  variations: VariationLike[],
  basePackSize?: number | string | null,
  unit?: string | null,
) => (variations || []).map((v) => withPackInfo(v, basePackSize, unit));
