import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { quantityOf, variantLimit } from "@/lib/cartLogic";
import { displayVariant, hasMultiplePrices, isSoldOut } from "@/lib/catalog";
import { formatNaira } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useCart } from "@/providers/CartProvider";
import { colors, radii, shadow, spacing, type } from "@/theme";
import { Badge, Button, Stepper } from "./ui";

export function ProductCard({ product }: { product: Product }) {
  const { cart, add, setQuantity } = useCart();
  const variant = displayVariant(product);
  const soldOut = isSoldOut(product);
  const inCart = quantityOf(cart, variant.id);
  const multi = hasMultiplePrices(product);

  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="link" accessibilityLabel={product.name} onPress={() => router.push(`/product/${product.slug}`)}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: product.images[0] }} style={[styles.image, soldOut && { opacity: 0.45 }]} contentFit="cover" transition={150} accessibilityLabel={product.name} />
          {product.badge && !soldOut ? (
            <View style={styles.badge}>
              <Badge text={product.badge} tone={product.badgeTone ?? "mint"} />
            </View>
          ) : null}
          {soldOut ? (
            <View style={styles.badge}>
              <Badge text="Sold out" tone="error" />
            </View>
          ) : null}
        </View>
        {product.origin ? <Text style={[type.bodySm, { color: colors.outline }]} numberOfLines={1}>{product.origin}</Text> : null}
        <Text style={[type.titleMd, styles.name]} numberOfLines={2}>{product.name}</Text>
      </Pressable>
      <View style={styles.footer}>
        <View style={{ flexShrink: 1 }}>
          {multi ? <Text style={[type.labelCaps, { color: colors.outline }]}>From</Text> : null}
          <Text style={[type.priceCard, { color: colors.onSurface }]}>{formatNaira(variant.priceKobo)}</Text>
        </View>
        {soldOut ? null : multi ? (
          <Button label="Options" variant="secondary" onPress={() => router.push(`/product/${product.slug}`)} style={styles.smallBtn} />
        ) : inCart > 0 ? null : (
          <Button label="Add" onPress={() => add(product, variant)} style={styles.smallBtn} />
        )}
      </View>
      {!multi && !soldOut && inCart > 0 ? (
        <Stepper label={product.name} value={inCart} max={variantLimit(variant)} onChange={(n) => setQuantity(variant.id, n)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.sm, gap: spacing.xs, ...shadow },
  imageWrap: { aspectRatio: 1, borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.surfaceLow, marginBottom: spacing.xs },
  image: { width: "100%", height: "100%" },
  badge: { position: "absolute", top: spacing.sm, left: spacing.sm },
  name: { color: colors.onSurface, minHeight: 48 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
  smallBtn: { paddingHorizontal: spacing.lg },
});
