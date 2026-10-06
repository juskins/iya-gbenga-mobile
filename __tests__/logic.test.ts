import { addLine, cartCount, cartSubtotal, clampQuantity, mergeGuestInto, setLineQuantity, variantLimit } from "@/lib/cartLogic";
import { friendlyRpcError } from "@/lib/errors";
import { formatNaira } from "@/lib/format";
import { activeOrder, countByFilter, matchesFilter, timelineProgress } from "@/lib/orderStatus";
import { checkoutSchema } from "@/lib/validators";
import type { Cart, CartLine } from "@/lib/types";

const line = (id: string, quantity: number, over: Partial<CartLine> = {}): CartLine => ({
  variantId: id,
  productSlug: id,
  name: id,
  variantLabel: "1kg",
  image: null,
  unitPriceKobo: 150000,
  quantity,
  maxPerOrder: 5,
  ...over,
});

describe("formatNaira", () => {
  it("formats kobo with separators and no decimals", () => {
    expect(formatNaira(1480000)).toBe("₦14,800");
    expect(formatNaira(0)).toBe("₦0");
    expect(formatNaira(99)).toBe("₦0");
    expect(formatNaira(123456700)).toBe("₦1,234,567");
  });
});

describe("cart clamp", () => {
  it("uses min(max_per_order, stock)", () => {
    expect(variantLimit({ maxPerOrder: 10, stockQty: 3 })).toBe(3);
    expect(variantLimit({ maxPerOrder: 2, stockQty: 50 })).toBe(2);
    expect(variantLimit({ maxPerOrder: 5, stockQty: 0 })).toBe(0);
  });
  it("clamps into [0, limit]", () => {
    expect(clampQuantity(9, 4)).toBe(4);
    expect(clampQuantity(-2, 4)).toBe(0);
  });
  it("addLine adds a delta and clamps; set<=0 removes", () => {
    let cart: Cart = { items: [], note: "" };
    cart = addLine(cart, line("a", 1), 3);
    cart = addLine(cart, line("a", 1), 9);
    expect(cart.items[0].quantity).toBe(5);
    expect(setLineQuantity(cart, "a", 0).items).toHaveLength(0);
  });
  it("totals", () => {
    const cart: Cart = { items: [line("a", 2), line("b", 1)], note: "" };
    expect(cartCount(cart)).toBe(3);
    expect(cartSubtotal(cart)).toBe(450000);
  });
});

describe("merge", () => {
  it("takes max per variant with no duplicates and is idempotent", () => {
    const server: Cart = { items: [line("a", 2)], note: "" };
    const guest: Cart = { items: [line("a", 1), line("b", 3)], note: "hi" };
    const once = mergeGuestInto(server, guest);
    expect(once.items.map((l) => [l.variantId, l.quantity])).toEqual([["a", 2], ["b", 3]]);
    expect(mergeGuestInto(once, guest)).toEqual(once);
  });
});

describe("rpc errors", () => {
  it("maps codes to friendly text", () => {
    expect(friendlyRpcError("OUT_OF_STOCK")).toMatch(/out of stock/);
    expect(friendlyRpcError("weird")).toMatch(/went wrong/);
  });
});

describe("checkout validation", () => {
  const ok = {
    firstName: "Folake", lastName: "Adeyemi", email: "f@example.com", phone: "0803 456 7890",
    street: "12 Admiralty Way", unit: "", state: "Lagos", lga: "Ikeja", landmark: "",
    shippingMethod: "x", paymentMethod: "pay_on_delivery", saveAsDefault: false,
  };
  it("accepts valid input", () => expect(checkoutSchema.safeParse(ok).success).toBe(true));
  it("rejects bad phone and non-Lagos", () => {
    expect(checkoutSchema.safeParse({ ...ok, phone: "12345" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...ok, state: "Abuja" }).success).toBe(false);
  });
});

describe("order status grouping", () => {
  const orders = [{ status: "dispatched" as const }, { status: "delivered" as const }, { status: "cancelled" as const }, { status: "pending" as const }];
  it("groups In Transit = confirmed+packing+dispatched", () => {
    expect(matchesFilter("packing", "in_transit")).toBe(true);
    expect(matchesFilter("pending", "in_transit")).toBe(false);
    expect(countByFilter(orders)).toEqual({ all: 4, in_transit: 1, delivered: 1, cancelled: 1 });
  });
  it("finds the active order and timeline progress", () => {
    expect(activeOrder(orders)?.status).toBe("dispatched");
    expect(timelineProgress("dispatched")).toBe(2);
    expect(timelineProgress("cancelled")).toBe(-1);
  });
});
