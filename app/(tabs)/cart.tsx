import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, IconButton, Skeleton, StateView, Stepper } from "@/components/ui";
import { useProducts, useStoreConfig } from "@/hooks/queries";
import { NOTE_MAX } from "@/lib/cartLogic";
import { displayVariant, isSoldOut } from "@/lib/catalog";
import { formatNaira } from "@/lib/format";
import { useAuth } from "@/providers/AuthProvider";
import { useCart } from "@/providers/CartProvider";
import { colors, radii, shadow, spacing, type } from "@/theme";

export default function CartScreen() {
  const { cart, loading, subtotalKobo, setQuantity, remove, setNote, refetch, add } = useCart();
  const { user } = useAuth();
  const config = useStoreConfig();
  const products = useProducts();

  const hasUnavailable = cart.items.some((l) => l.available === false);
  const threshold = config.data?.freeDeliveryThresholdKobo;

  const addOns = useMemo(() => {
    const inCart = new Set(cart.items.map((l) => l.productSlug));
    return (products.data ?? []).filter((p) => !inCart.has(p.slug) && !isSoldOut(p) && p.variants.length === 1).slice(0, 6);
  }, [products.data, cart.items]);

  if (loading) {
    return (
      <View style={styles.pad}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={96} />
        ))}
      </View>
    );
  }

  if (cart.items.length === 0) {
    return <StateView icon="shopping-cart" title="Your cart is empty" message="Add some fresh groceries to get started." actionLabel="Browse the shop" onAction={() => router.navigate("/shop")} />;
  }

  const checkout = () => (user ? router.push("/checkout") : router.push({ pathname: "/login", params: { next: "/checkout" } }));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.pad} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />} keyboardShouldPersistTaps="handled">
        {cart.items.map((l) => (
          <View key={l.variantId} style={styles.line}>
            <Pressable accessibilityRole="link" accessibilityLabel={l.name} onPress={() => router.push(`/product/${l.productSlug}`)}>
              {l.image ? <Image source={{ uri: l.image }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.titleMd, { color: colors.onSurface }]} numberOfLines={2}>{l.name}</Text>
              <Text style={[type.bodySm, { color: colors.onSurfaceVariant }]}>{l.variantLabel}</Text>
              {l.available === false ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Sold out, remove ${l.name}`} onPress={() => remove(l.variantId)}>
                  <Text style={[type.labelMd, { color: colors.error }]}>Sold out. Tap to remove</Text>
                </Pressable>
              ) : (
                <View style={styles.lineFooter}>
                  <Text style={[type.priceCard, { color: colors.onSurface }]}>{formatNaira(l.unitPriceKobo * l.quantity)}</Text>
                  <Stepper label={l.name} value={l.quantity} max={l.maxPerOrder} onChange={(n) => setQuantity(l.variantId, n)} />
                </View>
              )}
            </View>
            <IconButton icon="close" label={`Remove ${l.name}`} size={20} color={colors.outline} onPress={() => remove(l.variantId)} />
          </View>
        ))}

        <View style={styles.card}>
          <Text style={[type.labelCaps, { color: colors.outline }]}>Order note</Text>
          <TextInput
            value={cart.note}
            onChangeText={setNote}
            maxLength={NOTE_MAX}
            multiline
            placeholder="Anything we should know? (optional)"
            placeholderTextColor={colors.outline}
            accessibilityLabel="Order note"
            style={[type.bodyMd, styles.note]}
          />
          <Text style={[type.bodySm, { color: colors.outline, textAlign: "right" }]}>{cart.note.length}/{NOTE_MAX}</Text>
        </View>

        <View style={styles.card}>
          {threshold ? <FreeDelivery subtotal={subtotalKobo} threshold={threshold} /> : null}
          <SummaryRow label="Subtotal" value={formatNaira(subtotalKobo)} />
          <SummaryRow label="Delivery" value="Calculated at checkout" muted />
        </View>

        {addOns.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={type.headlineSm}>You might also like</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={addOns}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ gap: spacing.md }}
              renderItem={({ item }) => (
                <View style={styles.addOn}>
                  <Image source={{ uri: item.images[0] }} style={styles.addOnImg} contentFit="cover" />
                  <Text style={[type.labelMd, { color: colors.onSurface }]} numberOfLines={2}>{item.name}</Text>
                  <Text style={[type.priceCard, { color: colors.onSurface }]}>{formatNaira(displayVariant(item).priceKobo)}</Text>
                  <Button label="Add" onPress={() => add(item, displayVariant(item))} />
                </View>
              )}
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bar}>
        <View>
          <Text style={[type.bodySm, { color: colors.onSurfaceVariant }]}>Subtotal</Text>
          <Text style={[type.priceXl, { color: colors.primary }]}>{formatNaira(subtotalKobo)}</Text>
        </View>
        <Button label={hasUnavailable ? "Remove sold-out items" : "Proceed to Checkout"} disabled={hasUnavailable} onPress={checkout} style={{ flex: 1 }} />
      </View>
    </KeyboardAvoidingView>
  );
}

function FreeDelivery({ subtotal, threshold }: { subtotal: number; threshold: number }) {
  const remaining = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  return (
    <View style={{ gap: spacing.xs }} accessibilityLabel={remaining ? `${formatNaira(remaining)} away from free delivery` : "You qualify for free delivery"}>
      <Text style={[type.labelMd, { color: colors.primary }]}>{remaining ? `Add ${formatNaira(remaining)} more for free delivery` : "You've unlocked free delivery"}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]}>{label}</Text>
      <Text style={[type.titleMd, { color: muted ? colors.outline : colors.onSurface }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  line: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.md, ...shadow },
  thumb: { width: 76, height: 76, borderRadius: radii.md, backgroundColor: colors.surfaceLow },
  lineFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
  note: { minHeight: 64, textAlignVertical: "top", backgroundColor: colors.surfaceLow, borderRadius: radii.md, padding: spacing.md, color: colors.onSurface },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: "hidden" },
  fill: { height: 8, backgroundColor: colors.primaryContainer },
  addOn: { width: 150, backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.sm, gap: spacing.xs },
  addOnImg: { width: "100%", aspectRatio: 1, borderRadius: radii.md },
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
});
