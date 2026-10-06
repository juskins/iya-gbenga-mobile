import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AddressBlock, Card, OrderItems, paymentLabel, StatusTimeline } from "@/components/OrderParts";
import { Button, ErrorState, Skeleton, StateView } from "@/components/ui";
import { useStoreConfig } from "@/hooks/queries";
import { fetchOrderByNumber } from "@/lib/orders";
import { useToast } from "@/providers/ToastProvider";
import { colors, radii, spacing, type } from "@/theme";

export default function OrderConfirmation() {
  const { orderNumber } = useLocalSearchParams<{ orderNumber: string }>();
  const toast = useToast();
  const config = useStoreConfig();
  const order = useQuery({ queryKey: ["order", orderNumber], queryFn: () => fetchOrderByNumber(orderNumber) });

  if (order.isLoading) return <Skeleton height={300} style={{ margin: spacing.lg }} />;
  if (order.isError) return <ErrorState onRetry={() => void order.refetch()} />;
  if (!order.data) return <StateView icon="receipt-long" title="Order not found" actionLabel="My orders" onAction={() => router.replace("/orders")} />;
  const o = order.data;
  const bank = config.data?.bankTransfer;

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.banner}>
        <MaterialIcons name="check-circle" size={40} color={colors.primaryContainer} />
        <Text style={[type.headlineLg, { color: colors.primary }]}>Thank you for your order!</Text>
        <Text style={[type.bodyMd, { color: colors.onSurfaceVariant, textAlign: "center" }]}>A confirmation email is on its way to {o.contactEmail}.</Text>
      </View>

      <Card title="Order number">
        <View style={styles.numberRow}>
          <Text style={[type.headlineSm, { color: colors.onSurface }]} selectable>{o.orderNumber}</Text>
          <Button
            label="Copy"
            variant="secondary"
            icon="content-copy"
            onPress={() => {
              void Clipboard.setStringAsync(o.orderNumber);
              toast.show("Order number copied");
            }}
          />
        </View>
        <Text style={[type.bodySm, { color: colors.outline }]}>{o.contactPhone}</Text>
      </Card>

      <Card title="Items"><OrderItems order={o} /></Card>

      <Card title="Payment">
        <Text style={[type.bodyMd, { color: colors.onSurface }]}>{paymentLabel(o)}</Text>
        {o.paymentMethod === "bank_transfer" ? (
          bank ? (
            <View style={{ gap: 2 }}>
              <Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]}>Bank: {bank.bankName}</Text>
              <Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]} selectable>Account number: {bank.accountNumber}</Text>
              <Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]}>Account name: {bank.accountName}</Text>
              <Text style={[type.bodySm, { color: colors.outline }]}>Use {o.orderNumber} as the payment reference.</Text>
            </View>
          ) : (
            <Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]}>We will contact you shortly with our payment details.</Text>
          )
        ) : null}
      </Card>

      <Card title="Delivery address"><AddressBlock address={o.shippingAddress} /></Card>
      <Card title="Status"><StatusTimeline order={o} /></Card>

      <Button label="Continue Shopping" onPress={() => router.replace("/shop")} />
      <Button label="View my orders" variant="secondary" onPress={() => router.replace("/orders")} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  banner: { alignItems: "center", gap: spacing.sm, backgroundColor: colors.primaryFixed, borderRadius: radii.lg, padding: spacing.xl },
  numberRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
});
