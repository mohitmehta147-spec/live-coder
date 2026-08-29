import { supabase } from "@/lib/supabase";

/**
 * Trash-aware delete: moves the row to `trashed_items` (30-day retention),
 * then deletes from the source table. Restorable from Admin → Trash.
 */
export async function trashDelete(
  table: string,
  id: string | number,
  opts?: { label?: string; idColumn?: string }
): Promise<{ error: any | null }> {
  const idColumn = opts?.idColumn || "id";
  const client = supabase as any;

  // 1) Snapshot the row
  const { data: row, error: selErr } = await client
    .from(table)
    .select("*")
    .eq(idColumn, id)
    .maybeSingle();
  if (selErr) return { error: selErr };
  if (!row) return { error: new Error("Row not found") };

  // 2) Best-effort attach current user as deleted_by
  let deleted_by: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    deleted_by = data.user?.id ?? null;
  } catch {}

  // 3) Push to trash
  const label =
    opts?.label ||
    row.name ||
    row.title ||
    row.full_name ||
    row.email ||
    row.order_number ||
    String(id);

  const { error: insErr } = await client.from("trashed_items").insert({
    source_table: table,
    original_id: String(id),
    row_data: row,
    label,
    deleted_by,
  });
  if (insErr) return { error: insErr };

  // 4) Delete from source
  const { error: delErr } = await client.from(table).delete().eq(idColumn, id);
  if (delErr) {
    // rollback: remove the trash entry we just made
    await client
      .from("trashed_items")
      .delete()
      .eq("source_table", table)
      .eq("original_id", String(id));
    return { error: delErr };
  }

  return { error: null };
}

export async function restoreTrashed(trashId: string): Promise<{ error: any | null }> {
  const client = supabase as any;
  const { data: item, error } = await client
    .from("trashed_items")
    .select("*")
    .eq("id", trashId)
    .maybeSingle();
  if (error) return { error };
  if (!item) return { error: new Error("Trash item not found") };

  const row = { ...(item.row_data || {}) };
  const childItems = row.__order_items;
  delete row.__order_items;

  const { error: insErr } = await client.from(item.source_table).insert(row);
  if (insErr) return { error: insErr };

  if (item.source_table === "orders" && Array.isArray(childItems) && childItems.length) {
    const { error: itemsErr } = await client.from("order_items").insert(childItems);
    if (itemsErr) return { error: itemsErr };
  }

  const { error: delErr } = await client.from("trashed_items").delete().eq("id", trashId);
  return { error: delErr };
}

export async function purgeTrashed(trashId: string): Promise<{ error: any | null }> {
  const { error } = await (supabase as any).from("trashed_items").delete().eq("id", trashId);
  return { error };
}

/** Trash an order together with its order_items so a restore brings everything back. */
export async function trashDeleteOrder(orderId: string): Promise<{ error: any | null }> {
  const client = supabase as any;
  const { data: order, error: oErr } = await client.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (oErr) return { error: oErr };
  if (!order) return { error: new Error("Order not found") };
  const { data: items } = await client.from("order_items").select("*").eq("order_id", orderId);

  let deleted_by: string | null = null;
  try { const { data } = await supabase.auth.getUser(); deleted_by = data.user?.id ?? null; } catch {}

  const snapshot = { ...order, __order_items: items || [] };
  const { error: insErr } = await client.from("trashed_items").insert({
    source_table: "orders",
    original_id: String(orderId),
    row_data: snapshot,
    label: order.order_number || String(orderId),
    deleted_by,
  });
  if (insErr) return { error: insErr };

  await client.from("order_items").delete().eq("order_id", orderId);
  const { error: delErr } = await client.from("orders").delete().eq("id", orderId);
  if (delErr) {
    await client.from("trashed_items").delete().eq("source_table", "orders").eq("original_id", String(orderId));
    return { error: delErr };
  }
  return { error: null };
}
