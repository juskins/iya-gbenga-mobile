import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { formatLagosDate, formatNaira } from "@/lib/format";
import { STATUS_LABEL, TIMELINE, timelineProgress } from "@/lib/orderStatus";
import type { Order, OrderAddress, OrderStatus } from "@/lib/types";
import { colors, radii, spacing, type } from "@/theme";
import { Badge } from "./ui";

export function StatusBadge({ status }: { status: OrderStatus }) {
  const tone = status === "delivered" ? "mint" : status === "cancelled" ? "error" : "orange";
  return <Badge text={STATUS_LABEL[status]} tone={tone} />;
}

export function StatusTimeline({ order }: { order: Pick<Order, "status" | "events"> }) {
  if (order.status === "cancelled") return <Text style={[type.bodyMd, { color: colors.error }]}>This order was cancelled.</Text>;
  const progress = timelineProgress(order.status);
  return (
    <View style={{ gap: spacing.md }} accessibilityLabel={`Order status: ${STATUS_LABEL[order.status]}`}>
      {TIMELINE.map((step, i) => {
        const done = i <= progress;
        const at = order.events.find((e) => e.status === step.key || (i === 0 && e.status === "confirmed"));
        return (
          <View key={step.key} style={styles.step}>
            <MaterialIcons name={done ? "check-circle" : "radio-button-unchecked"} size={22} color={done ? colors.primaryContainer : colors.outlineVariant} />
            <Text style={[type.titleMd, { color: done ? colors.onSurface : colors.outline, flex: 1 }]}>{step.label}</Text>
            {done && at ? <Text style={[type.bodySm, { color: colors.outline }]}>{formatLagosDate(at.createdAt)}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

export function AddressBlock({ address }: { address: OrderAddress }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={[type.titleMd, { color: colors.onSurface }]}>{address.recipient}</Text>
      <Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]}>
        {[address.street, address.unit, address.lga, address.state].filter(Boolean).join(", ")}
      </Text>
      {address.landmark ? <Text style={[type.bodySm, { color: colors.outline }]}>Near {address.landmark}</Text> : null}
      <Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]}>{address.phone}</Text>
    </View>
  );
}

export function OrderItems({ order }: { order: Order }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {order.items.map((i, idx) => (
        <View key={`${i.variantId}-${idx}`} style={styles.row}>
          <Text style={[type.bodyMd, { flex: 1, color: colors.onSurface }]}>{i.quantity} × {i.productName} ({i.variantLabel})</Text>
          <Text style={[type.titleMd, { color: colors.onSurface }]}>{formatNaira(i.unitPriceKobo * i.quantity)}</Text>
        </View>
      ))}
      <View style={styles.divider} />
      <Row label="Subtotal" value={formatNaira(order.subtotalKobo)} />
      <Row label={`Delivery${order.shippingMethodName ? ` (${order.shippingMethodName})` : ""}`} value={order.shippingKobo === 0 ? "Free" : formatNaira(order.shippingKobo)} />
      <Row label="Total" value={formatNaira(order.totalKobo)} strong />
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[strong ? type.titleMd : type.bodyMd, { color: colors.onSurface }]}>{label}</Text>
      <Text style={[strong ? type.priceCard : type.titleMd, { color: strong ? colors.primary : colors.onSurface }]}>{value}</Text>
    </View>
  );
}

export const paymentLabel = (o: Pick<Order, "paymentMethod" | "paymentStatus">): string =>
  `${o.paymentMethod === "bank_transfer" ? "Bank Transfer" : "Pay on Delivery"} · ${o.paymentStatus === "paid" ? "Paid" : "Payment pending"}`;

export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={[type.labelCaps, { color: colors.outline }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  divider: { height: 1, backgroundColor: colors.outlineVariant },
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
});
