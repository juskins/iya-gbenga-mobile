import type { Cart, CartLine, Product, Variant } from "./types";

export const NOTE_MAX = 250;

export const EMPTY_CART: Cart = { items: [], note: "" };

/** Effective per-order limit of a variant: min(max_per_order, stock_qty). */
export function variantLimit(v: Pick<Variant, "maxPerOrder" | "stockQty">): number {
  return Math.max(0, Math.min(v.maxPerOrder, v.stockQty));
}

export function clampQuantity(quantity: number, limit: number): number {
  return Math.max(0, Math.min(Math.trunc(quantity), limit));
}

export function cartCount(cart: Cart): number {
  return cart.items.reduce((n, l) => n + l.quantity, 0);
}

/** Display only; the server re-prices everything at checkout. */
export function cartSubtotal(cart: Cart): number {
  return cart.items.reduce((sum, l) => sum + l.unitPriceKobo * l.quantity, 0);
}

export function lineFromProduct(product: Product, variant: Variant, quantity: number): CartLine {
  return {
    variantId: variant.id,
    productSlug: product.slug,
    name: product.name,
    variantLabel: variant.label,
    image: product.images[0] ?? null,
    unitPriceKobo: variant.priceKobo,
    quantity,
    maxPerOrder: variantLimit(variant),
    stockQty: variant.stockQty,
    available: variant.stockQty > 0,
  };
}

/** Optimistic "add" (delta), clamped to the line's limit. */
export function addLine(cart: Cart, line: CartLine, delta: number): Cart {
  const existing = cart.items.find((l) => l.variantId === line.variantId);
  if (!existing) {
    const quantity = clampQuantity(delta, line.maxPerOrder);
    return quantity < 1 ? cart : { ...cart, items: [...cart.items, { ...line, quantity }] };
  }
  const quantity = clampQuantity(existing.quantity + delta, existing.maxPerOrder);
  return { ...cart, items: cart.items.map((l) => (l.variantId === line.variantId ? { ...l, quantity } : l)) };
}

export function removeLine(cart: Cart, variantId: string): Cart {
  return { ...cart, items: cart.items.filter((l) => l.variantId !== variantId) };
}

/** Optimistic absolute set; <= 0 removes the line. */
export function setLineQuantity(cart: Cart, variantId: string, quantity: number): Cart {
  if (quantity <= 0) return removeLine(cart, variantId);
  return {
    ...cart,
    items: cart.items.map((l) => (l.variantId === variantId ? { ...l, quantity: clampQuantity(quantity, l.maxPerOrder) } : l)),
  };
}

export function quantityOf(cart: Cart, variantId: string): number {
  return cart.items.find((l) => l.variantId === variantId)?.quantity ?? 0;
}

/** Mirrors merge_cart on the server: max(existing, incoming) per variant, no duplicates. */
export function mergeGuestInto(server: Cart, guest: Cart): Cart {
  const items = [...server.items];
  for (const g of guest.items) {
    const i = items.findIndex((l) => l.variantId === g.variantId);
    if (i === -1) items.push(g);
    else items[i] = { ...items[i], quantity: Math.max(items[i].quantity, g.quantity) };
  }
  return { items, note: server.note || guest.note };
}
