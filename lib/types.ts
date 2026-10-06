import type { BadgeTone } from "@/theme";

export type Variant = {
  id: string;
  label: string;
  sku: string | null;
  priceKobo: number;
  compareAtPriceKobo: number | null;
  stockQty: number;
  maxPerOrder: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  origin: string | null;
  badge: string | null;
  badgeTone: BadgeTone | null;
  createdAt: string;
  categorySlug: string;
  categoryName: string;
  variants: Variant[]; // sorted by price
  images: string[]; // sorted by sort_order
  relatedIds: string[];
};

export type Category = { id: string; name: string; slug: string; imageUrl: string | null };

export type CartLine = {
  variantId: string;
  productSlug: string;
  name: string;
  variantLabel: string;
  image: string | null;
  unitPriceKobo: number;
  quantity: number;
  maxPerOrder: number;
  stockQty?: number;
  available?: boolean;
};

export type Cart = { items: CartLine[]; note: string };

export type ShippingMethod = {
  id: string;
  name: string;
  priceKobo: number;
  freeAboveKobo: number | null;
  etaText: string | null;
  cutoffTime: string | null;
};

export type OrderStatus = "pending" | "confirmed" | "packing" | "dispatched" | "delivered" | "cancelled";
export type PaymentMethod = "pay_on_delivery" | "bank_transfer";

export type OrderAddress = {
  recipient: string;
  phone: string;
  street: string;
  unit?: string | null;
  state: string;
  lga: string;
  landmark?: string | null;
};

export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: "pending" | "paid";
  subtotalKobo: number;
  shippingKobo: number;
  totalKobo: number;
  shippingMethodName: string | null;
  shippingAddress: OrderAddress;
  contactEmail: string | null;
  contactPhone: string | null;
  note: string | null;
  createdAt: string;
  items: { variantId: string | null; productName: string; variantLabel: string; unitPriceKobo: number; quantity: number }[];
  events: { status: OrderStatus; createdAt: string }[];
};
