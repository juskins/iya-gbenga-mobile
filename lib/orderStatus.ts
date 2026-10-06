import type { Order, OrderStatus } from "./types";

export type OrderFilter = "all" | "in_transit" | "delivered" | "cancelled";

const IN_TRANSIT: OrderStatus[] = ["confirmed", "packing", "dispatched"];

export function matchesFilter(status: OrderStatus, filter: OrderFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "in_transit":
      return IN_TRANSIT.includes(status);
    case "delivered":
      return status === "delivered";
    case "cancelled":
      return status === "cancelled";
  }
}

export function countByFilter(orders: Pick<Order, "status">[]): Record<OrderFilter, number> {
  return {
    all: orders.length,
    in_transit: orders.filter((o) => matchesFilter(o.status, "in_transit")).length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };
}

/** Most recent order that is neither delivered nor cancelled (orders must be newest-first). */
export function activeOrder<T extends Pick<Order, "status">>(orders: T[]): T | undefined {
  return orders.find((o) => o.status !== "delivered" && o.status !== "cancelled");
}

export function matchesSearch(order: Pick<Order, "orderNumber" | "items">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return order.orderNumber.toLowerCase().includes(q) || order.items.some((i) => i.productName.toLowerCase().includes(q));
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Received",
  confirmed: "Confirmed",
  packing: "Packing",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Timeline steps: Received, Packing, Dispatched, Delivered. */
export const TIMELINE: { key: OrderStatus; label: string }[] = [
  { key: "pending", label: "Received" },
  { key: "packing", label: "Packing" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
];

/** Index of the furthest completed timeline step (confirmed counts as Received); -1 when cancelled. */
export function timelineProgress(status: OrderStatus): number {
  if (status === "cancelled") return -1;
  if (status === "pending" || status === "confirmed") return 0;
  return TIMELINE.findIndex((t) => t.key === status);
}
