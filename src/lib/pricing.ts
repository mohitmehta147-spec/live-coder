// Shared price helpers.
// Products can have variations (packs). The FIRST variation is the "Pack of 1",
// and that is the price customers must see on every listing / card, so the
// front page never disagrees with the product page's default selection.

export type AnyProduct = Record<string, any>;

export const packOnePrice = (p: AnyProduct) => {
  const v = Array.isArray(p?.variations) ? p.variations[0] : null;
  const price = Number(v?.price) || Number(p?.price) || 0;
  const mrp = Number(v?.mrp) || Number(p?.mrp) || 0;
  return { price, mrp };
};

/** Returns the product with price/mrp replaced by the Pack of 1 values. */
export const withPackPrice = <T extends AnyProduct>(p: T): T => ({ ...p, ...packOnePrice(p) });

export const withPackPrices = <T extends AnyProduct>(rows: T[] | null | undefined): T[] =>
  (rows || []).map(withPackPrice);

/** A product belongs to a category via category_id or the multi-category list. */
export const inCategory = (p: AnyProduct, categoryId: string) => {
  if (!categoryId) return false;
  if (p?.category_id === categoryId) return true;
  const list = p?.category_ids;
  if (Array.isArray(list)) return list.includes(categoryId);
  if (typeof list === "string") { try { return JSON.parse(list).includes(categoryId); } catch { return false; } }
  return false;
};
