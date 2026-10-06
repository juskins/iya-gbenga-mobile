import { rpcAdd } from "./cartApi";
import { supabase } from "./supabase";
import type { Order, OrderStatus } from "./types";

export const ORDERS_PAGE_SIZE = 10;

const SELECT = `id, order_number, status, payment_method, payment_status, subtotal_kobo, shipping_kobo, total_kobo,
  shipping_method_name, shipping_address, contact_email, contact_phone, note, created_at,
  order_items(variant_id, product_name, variant_label, unit_price_kobo, quantity),
  order_events(status, created_at)`;

type OrderRow = {
  id: string;
  order_number: string;
  status: Order["status"];
  payment_method: Order["paymentMethod"];
  payment_status: Order["paymentStatus"];
  subtotal_kobo: number;
  shipping_kobo: number;
  total_kobo: number;
  shipping_method_name: string | null;
  shipping_address: Order["shippingAddress"];
  contact_email: string | null;
  contact_phone: string | null;
  note: string | null;
  created_at: string;
  order_items: { variant_id: string | null; product_name: string; variant_label: string; unit_price_kobo: number; quantity: number }[];
  order_events: { status: OrderStatus; created_at: string }[];
};

function mapOrder(r: OrderRow): Order {
  return {
    id: r.id,
    orderNumber: r.order_number,
    status: r.status,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    subtotalKobo: r.subtotal_kobo,
    shippingKobo: r.shipping_kobo,
    totalKobo: r.total_kobo,
    shippingMethodName: r.shipping_method_name,
    shippingAddress: r.shipping_address,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    note: r.note,
    createdAt: r.created_at,
    items: r.order_items.map((i) => ({
      variantId: i.variant_id,
      productName: i.product_name,
      variantLabel: i.variant_label,
      unitPriceKobo: i.unit_price_kobo,
      quantity: i.quantity,
    })),
    events: [...r.order_events].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((e) => ({ status: e.status, createdAt: e.created_at })),
  };
}

// Orders are READ-ONLY here; they are created only through POST /api/orders. RLS limits rows to the owner.
export async function fetchOrdersPage(page: number): Promise<Order[]> {
  const from = page * ORDERS_PAGE_SIZE;
  const { data, error } = await supabase
    .from("orders")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .range(from, from + ORDERS_PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as OrderRow[]).map(mapOrder);
}

export async function fetchOrderByNumber(orderNumber: string): Promise<Order | null> {
  const { data, error } = await supabase.from("orders").select(SELECT).eq("order_number", orderNumber).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapOrder(data as unknown as OrderRow) : null;
}

/** Re-adds each line through add_to_cart at CURRENT prices (never old ones). Returns the names that were skipped. */
export async function reorder(order: Order): Promise<string[]> {
  const skipped: string[] = [];
  for (const item of order.items) {
    if (!item.variantId) {
      skipped.push(item.productName);
      continue;
    }
    try {
      await rpcAdd(item.variantId, item.quantity);
    } catch {
      skipped.push(item.productName);
    }
  }
  return skipped;
}
