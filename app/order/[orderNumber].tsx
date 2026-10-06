import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import { AddressBlock, Card, OrderItems, paymentLabel, StatusBadge, StatusTimeline } from "@/components/OrderParts";
import { ErrorState, Skeleton, StateView } from "@/components/ui";
import { formatLagosDate } from "@/lib/format";
import { fetchOrderByNumber } from "@/lib/orders";
import { colors, spacing, type } from "@/theme";

export default function OrderDetail() {
  const { orderNumber } = useLocalSearchParams<{ orderNumber: string }>();
  const order = useQuery({ queryKey: ["order", orderNumber], queryFn: () => fetchOrderByNumber(orderNumber) });

  if (order.isLoading) return <Skeleton height={300} style={{ margin: spacing.lg }} />;
  if (order.isError) return <ErrorState onRetry={() => void order.refetch()} />;
  if (!order.data) return <StateView icon="receipt-long" title="Order not found" actionLabel="My orders" onAction={() => router.replace("/orders")} />;
  const o = order.data;

  return (
    <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={order.isRefetching} onRefresh={() => void order.refetch()} tintColor={colors.primary} />}>
      <Card>
        <Text style={[type.headlineSm, { color: colors.onSurface }]}>{o.orderNumber}</Text>
        <Text style={[type.bodySm, { color: colors.outline }]}>Placed {formatLagosDate(o.createdAt)}</Text>
        <StatusBadge status={o.status} />
      </Card>
      <Card title="Items"><OrderItems order={o} /></Card>
      <Card title="Payment"><Text style={[type.bodyMd, { color: colors.onSurface }]}>{paymentLabel(o)}</Text></Card>
      <Card title="Delivery address"><AddressBlock address={o.shippingAddress} /></Card>
      {o.note ? <Card title="Order note"><Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]}>{o.note}</Text></Card> : null}
      <Card title="Status"><StatusTimeline order={o} /></Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl } });
