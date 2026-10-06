import { MaterialIcons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Card, paymentLabel, StatusBadge, StatusTimeline } from "@/components/OrderParts";
import { Button, Chip, ErrorState, OfflineBanner, Skeleton, StateView } from "@/components/ui";
import { useOnline } from "@/hooks/useOnline";
import { formatLagosDate, formatNaira } from "@/lib/format";
import { fetchOrdersPage, ORDERS_PAGE_SIZE, reorder } from "@/lib/orders";
import { activeOrder, countByFilter, matchesFilter, matchesSearch, type OrderFilter } from "@/lib/orderStatus";
import type { Order } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { useCart } from "@/providers/CartProvider";
import { useToast } from "@/providers/ToastProvider";
import { colors, radii, spacing, type } from "@/theme";

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_transit", label: "In Transit" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

export default function Orders() {
  const { user, loading: authLoading } = useAuth();
  const { refetch: refetchCart } = useCart();
  const toast = useToast();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [search, setSearch] = useState("");
  const [reordering, setReordering] = useState<string | null>(null);

  const query = useInfiniteQuery({
    queryKey: ["orders", user?.id],
    queryFn: ({ pageParam }) => fetchOrdersPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.length === ORDERS_PAGE_SIZE ? pages.length : undefined),
    enabled: !!user,
  });
  const online = useOnline(() => void query.refetch());

  const orders = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);
  const counts = useMemo(() => countByFilter(orders), [orders]);
  const active = useMemo(() => activeOrder(orders), [orders]);
  const shown = useMemo(() => orders.filter((o) => matchesFilter(o.status, filter) && matchesSearch(o, search)), [orders, filter, search]);

  const onReorder = async (order: Order) => {
    setReordering(order.id);
    const skipped = await reorder(order);
    setReordering(null);
    refetchCart();
    if (skipped.length) toast.show(`Some items were unavailable: ${skipped.join(", ")}`);
    router.navigate("/cart");
  };

  if (authLoading) return <Skeleton height={200} style={{ margin: spacing.lg }} />;
  if (!user) {
    return <StateView icon="receipt-long" title="Sign in to see your orders" message="Your orders appear here on every device." actionLabel="Sign in" onAction={() => router.push({ pathname: "/login", params: { next: "/orders" } })} />;
  }
  if (query.isError && orders.length === 0) return <ErrorState onRetry={() => void query.refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {!online ? <OfflineBanner /> : null}
      <FlatList
        data={shown}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
        onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && void query.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            <View style={styles.search}>
              <MaterialIcons name="search" size={20} color={colors.outline} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Order number or product" placeholderTextColor={colors.outline} accessibilityLabel="Search orders" style={[type.bodyMd, { flex: 1, color: colors.onSurface }]} />
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={FILTERS}
              keyExtractor={(f) => f.key}
              contentContainerStyle={{ gap: spacing.sm }}
              renderItem={({ item }) => <Chip label={`${item.label} (${counts[item.key]})`} selected={filter === item.key} onPress={() => setFilter(item.key)} />}
            />
            {active && filter === "all" && !search ? (
              <Card title="Active order">
                <Text style={[type.titleMd, { color: colors.onSurface }]}>{active.orderNumber}</Text>
                <StatusTimeline order={active} />
                <Button label="Track order" variant="secondary" onPress={() => router.push(`/order/${active.orderNumber}`)} />
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? (
            <Skeleton height={140} />
          ) : (
            <StateView icon="receipt-long" title={orders.length ? "No matching orders" : "No orders yet"} message={orders.length ? "Try another filter or search." : "When you place an order it will show up here."} actionLabel={orders.length ? undefined : "Start shopping"} onAction={() => router.navigate("/shop")} />
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.order, item.status === "cancelled" && { opacity: 0.7 }]}>
            <View style={styles.rowBetween}>
              <Text style={[type.titleMd, { color: colors.onSurface }]}>{item.orderNumber}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={[type.bodySm, { color: colors.outline }]}>{formatLagosDate(item.createdAt)} · {paymentLabel(item)}</Text>
            <View style={styles.chips}>
              {item.items.slice(0, 3).map((i, idx) => (
                <Text key={idx} style={[type.labelMd, styles.itemChip]} numberOfLines={1}>{i.quantity}× {i.productName}</Text>
              ))}
              {item.items.length > 3 ? <Text style={[type.labelMd, styles.itemChip]}>+{item.items.length - 3} more</Text> : null}
            </View>
            <View style={styles.rowBetween}>
              <Text style={[type.priceCard, { color: colors.primary }]}>{formatNaira(item.totalKobo)}</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button label="Reorder" variant="secondary" loading={reordering === item.id} onPress={() => void onReorder(item)} />
                <Button label="Details" onPress={() => router.push(`/order/${item.orderNumber}`)} />
              </View>
            </View>
          </View>
        )}
        ListFooterComponent={query.isFetchingNextPage ? <Skeleton height={100} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radii.pill, paddingHorizontal: spacing.lg, minHeight: 48, borderWidth: 1, borderColor: colors.outlineVariant },
  order: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  itemChip: { color: colors.onSurfaceVariant, backgroundColor: colors.surfaceLow, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 4, maxWidth: "100%" },
});
