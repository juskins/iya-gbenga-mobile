import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { Badge, Button, Chip, ErrorState, Skeleton, StateView, Stepper } from "@/components/ui";
import { useProducts, useStoreConfig } from "@/hooks/queries";
import { whatsappLink } from "@/lib/api";
import { variantLimit } from "@/lib/cartLogic";
import { formatNaira } from "@/lib/format";
import { useCart } from "@/providers/CartProvider";
import { useAuth } from "@/providers/AuthProvider";
import { colors, radii, spacing, type } from "@/theme";

const TABS = ["Description", "Sourcing & Freshness", "Storage & Shelf Life"] as const;
const COPY: Record<(typeof TABS)[number], string> = {
  "Sourcing & Freshness": "Sourced from trusted Nigerian markets and farms, then cleaned and sorted before packing.",
  "Storage & Shelf Life": "Store in a cool, dry place. Refrigerate fresh items and keep sealed packs closed after opening.",
  Description: "",
};

export default function ProductDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const products = useProducts();
  const config = useStoreConfig();
  const { add } = useCart();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const product = products.data?.find((p) => p.slug === slug);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Description");
  const [image, setImage] = useState(0);

  const variant = useMemo(() => product?.variants.find((v) => v.id === variantId) ?? product?.variants.find((v) => variantLimit(v) > 0) ?? product?.variants[0], [product, variantId]);
  const limit = variant ? variantLimit(variant) : 0;
  const quantity = Math.max(1, Math.min(qty, limit || 1));

  const related = useMemo(() => (product ? (products.data ?? []).filter((p) => product.relatedIds.includes(p.id)).slice(0, 3) : []), [product, products.data]);

  if (products.isLoading) return <Skeleton height={320} style={{ margin: spacing.lg }} />;
  if (products.isError) return <ErrorState onRetry={() => void products.refetch()} />;
  if (!product || !variant) return <StateView icon="search-off" title="Product not found" actionLabel="Back to shop" onAction={() => router.replace("/shop")} />;

  const soldOut = limit < 1;
  const stockText = soldOut ? "Out of stock" : variant.stockQty <= 10 ? `Low stock, only ${variant.stockQty} left` : "In stock";
  const wa = whatsappLink(config.data?.whatsappNumber ?? null, `Hello! I'd like to order ${quantity} x ${product.name} (${variant.label}).`);

  const buyNow = () => {
    add(product, variant, quantity);
    if (user) router.push("/checkout");
    else router.push({ pathname: "/login", params: { next: "/checkout" } });
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: product.name }} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <Image source={{ uri: product.images[image] }} style={styles.hero} contentFit="cover" accessibilityLabel={product.name} />
        {product.images.length > 1 ? (
          <FlatList
            horizontal
            data={product.images}
            keyExtractor={(u, i) => `${u}-${i}`}
            contentContainerStyle={styles.thumbs}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <Pressable accessibilityRole="button" accessibilityLabel={`Show image ${index + 1}`} onPress={() => setImage(index)}>
                <Image source={{ uri: item }} style={[styles.thumb, index === image && { borderColor: colors.primary }]} contentFit="cover" />
              </Pressable>
            )}
          />
        ) : null}

        <View style={styles.body}>
          {product.badge ? <Badge text={product.badge} tone={product.badgeTone ?? "mint"} /> : null}
          <Text style={[type.headlineXl, { color: colors.onSurface }]}>{product.name}</Text>
          {product.origin ? <Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]}>{product.origin}</Text> : null}
          {variant.sku ? <Text style={[type.bodySm, { color: colors.outline }]}>SKU: {variant.sku}</Text> : null}

          <View style={styles.priceRow}>
            <Text style={[type.priceXl, { color: colors.primary }]}>{formatNaira(variant.priceKobo)}</Text>
            {variant.compareAtPriceKobo ? <Text style={[type.bodyLg, styles.strike]}>{formatNaira(variant.compareAtPriceKobo)}</Text> : null}
          </View>
          <Text style={[type.labelMd, { color: soldOut ? colors.error : variant.stockQty <= 10 ? colors.secondary : colors.primaryContainer }]}>{stockText}</Text>

          {product.variants.length > 1 ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[type.labelCaps, { color: colors.outline }]}>Size</Text>
              <View style={styles.wrap}>
                {product.variants.map((v) => (
                  <Chip key={v.id} label={`${v.label} · ${formatNaira(v.priceKobo)}`} selected={v.id === variant.id} onPress={() => setVariantId(v.id)} />
                ))}
              </View>
            </View>
          ) : (
            <Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]}>{variant.label}</Text>
          )}

          <View style={styles.wrap}>
            {TABS.map((t) => (
              <Chip key={t} label={t} selected={tab === t} onPress={() => setTab(t)} />
            ))}
          </View>
          <Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]}>{tab === "Description" ? product.description ?? "Authentic Nigerian groceries, carefully packed." : COPY[tab]}</Text>

          {wa ? <Button label="Order via WhatsApp" variant="secondary" icon="chat" onPress={() => void Linking.openURL(wa)} /> : null}

          {related.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <Text style={type.headlineSm}>Frequently bought together</Text>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                {related.slice(0, 2).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Stepper label={product.name} value={quantity} max={Math.max(1, limit)} onChange={(n) => setQty(Math.max(1, Math.min(n, Math.max(1, limit))))} />
        <Button label={soldOut ? "Sold out" : "Add to Cart"} disabled={soldOut} onPress={() => add(product, variant, quantity)} style={{ flex: 1 }} />
        {!soldOut ? <Button label="Buy Now" variant="secondary" onPress={buyNow} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", aspectRatio: 1, backgroundColor: colors.surfaceLow },
  thumbs: { gap: spacing.sm, padding: spacing.lg },
  thumb: { width: 64, height: 64, borderRadius: radii.md, borderWidth: 2, borderColor: "transparent" },
  body: { padding: spacing.lg, gap: spacing.md },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  strike: { color: colors.outline, textDecorationLine: "line-through" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
});
