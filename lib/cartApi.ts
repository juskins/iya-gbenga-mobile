import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";
import { EMPTY_CART } from "./cartLogic";
import { supabase } from "./supabase";
import type { Cart } from "./types";

// Signed-in carts are read/written ONLY through these RPCs (never the cart tables directly).

const lineSchema = z.object({
  variantId: z.string(),
  productSlug: z.string(),
  name: z.string(),
  variantLabel: z.string(),
  image: z.string().nullable().optional(),
  unitPriceKobo: z.number(),
  quantity: z.number(),
  maxPerOrder: z.number(),
  stockQty: z.number().optional(),
  available: z.boolean().optional(),
});

const cartSchema = z.object({ note: z.string().nullable().optional(), items: z.array(lineSchema) });

async function call(fn: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchCart(): Promise<Cart> {
  const parsed = cartSchema.parse(await call("get_cart"));
  return { note: parsed.note ?? "", items: parsed.items.map((l) => ({ ...l, image: l.image ?? null })) };
}

export const rpcAdd = (variantId: string, quantity: number) => call("add_to_cart", { p_variant_id: variantId, p_quantity: quantity });
export const rpcSet = (variantId: string, quantity: number) => call("set_cart_quantity", { p_variant_id: variantId, p_quantity: quantity });
export const rpcRemove = (variantId: string) => call("remove_from_cart", { p_variant_id: variantId });
export const rpcNote = (note: string) => call("set_cart_note", { p_note: note });
export const rpcClear = () => call("clear_cart");
export const rpcMerge = (cart: Cart) =>
  call("merge_cart", { p_items: cart.items.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })), p_note: cart.note || null });

// ---- Guest cart: AsyncStorage only, used while signed out.
const GUEST_KEY = "guest-cart-v1";

export async function loadGuestCart(): Promise<Cart> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_KEY);
    if (!raw) return EMPTY_CART;
    const parsed = cartSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { note: parsed.data.note ?? "", items: parsed.data.items.map((l) => ({ ...l, image: l.image ?? null })) } : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

export const saveGuestCart = (cart: Cart) => AsyncStorage.setItem(GUEST_KEY, JSON.stringify(cart));
export const clearGuestCart = () => AsyncStorage.removeItem(GUEST_KEY);
