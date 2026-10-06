import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { Button, Chip, ErrorState, OfflineBanner, Skeleton } from "@/components/ui";
import { useCategories, useProducts, useStoreConfig } from "@/hooks/queries";
import { useOnline } from "@/hooks/useOnline";
import { whatsappLink } from "@/lib/api";
import { colors, radii, spacing, type } from "@/theme";

const TRUST = [
  { icon: "local-shipping", text: "Delivery across Lagos" },
  { icon: "verified", text: "Quality guarantee" },
  { icon: "agriculture", text: "Direct from the market" },
] as const;

const WHY = [
  { icon: "fact-check", title: "Handpicked sorting", text: "Every order is checked and sorted by hand before it is packed." },
  { icon: "inventory-2", title: "Sealed for freshness", text: "Packed to keep flavour and aroma until it reaches your kitchen." },
  { icon: "two-wheeler", title: "Careful dispatch", text: "Dispatched from our Lagos pickup point to your door." },
] as const;

export default function Home() {
  const insets = useSafeAreaInsets();
  const products = useProducts();
  const categories = useCategories();
  const config = useStoreConfig();
  const online = useOnline(() => void products.refetch());
  const [tab, setTab] = useState<string | null>(null);

  const featured = useMemo(() => {
    const all = products.data ?? [];
    return (tab ? all.filter((p) => p.categorySlug === tab) : all).slice(0, 8);
  }, [products.data, tab]);

  const wa = whatsappLink(config.data?.whatsappNumber ?? null, "Hello Iya Gbenga's Store, I'd like to place an order.");

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {!online ? <OfflineBanner /> : null}
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl }}
        refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => void products.refetch()} tintColor={colors.primary} />}
      >
        <View style={styles.hero}>
          <Image source={require("../../assets/logo.png")} style={styles.logo} contentFit="contain" accessibilityLabel="Iya Gbenga's Store" />
          <Text style={[type.displayHero, { color: colors.primary }]}>Authentic Nigerian groceries, straight from the market to your kitchen.</Text>
          <Text style={[type.bodyLg, { color: colors.onSurfaceVariant }]}>Yams, palm oil, garri, dried fish and more, delivered across Lagos.</Text>
          <Button label="Shop Groceries Now" icon="arrow-forward" onPress={() => router.navigate("/shop")} />
        </View>

        <View style={styles.trust}>
          {TRUST.map((t) => (
            <View key={t.text} style={styles.trustItem}>
              <MaterialIcons name={t.icon} size={22} color={colors.secondary} />
              <Text style={[type.labelMd, { color: colors.onSurfaceVariant, textAlign: "center" }]}>{t.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ gap: spacing.md }}>
          <Text style={[type.headlineLg, styles.pad, { color: colors.onSurface }]}>Shop by category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.pad, { gap: spacing.md }]}>
            {(categories.data ?? []).map((c) => (
              <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={c.name} onPress={() => router.navigate({ pathname: "/shop", params: { category: c.slug } })} style={styles.cat}>
                {c.imageUrl ? <Image source={{ uri: c.imageUrl }} style={styles.catImg} contentFit="cover" /> : <View style={styles.catImg} />}
                <Text style={[type.labelMd, { color: colors.onSurface, textAlign: "center" }]} numberOfLines={2}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.pad, { gap: spacing.md }]}>
          <Text style={[type.headlineLg, { color: colors.onSurface }]}>Best of the Market</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            <Chip label="All" selected={tab === null} onPress={() => setTab(null)} />
            {(categories.data ?? []).map((c) => (
              <Chip key={c.id} label={c.name} selected={tab === c.slug} onPress={() => setTab(c.slug)} />
            ))}
          </ScrollView>
          {products.isLoading ? (
            <View style={styles.grid}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={250} width="48%" />
              ))}
            </View>
          ) : products.isError ? (
            <ErrorState onRetry={() => void products.refetch()} />
          ) : (
            <View style={styles.grid}>
              {featured.map((p) => (
                <View key={p.id} style={{ width: "48%" }}>
                  <ProductCard product={p} />
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.why}>
          <Text style={[type.headlineLg, { color: colors.onPrimary }]}>Why shop with Iya Gbenga&apos;s</Text>
          {WHY.map((w) => (
            <View key={w.title} style={styles.whyCard}>
              <MaterialIcons name={w.icon} size={26} color={colors.secondaryContainer} />
              <Text style={[type.titleMd, { color: colors.onPrimary }]}>{w.title}</Text>
              <Text style={[type.bodyMd, { color: colors.primaryFixedDim }]}>{w.text}</Text>
            </View>
          ))}
        </View>

        {wa ? (
          <View style={[styles.pad, { gap: spacing.md }]}>
            <View style={styles.contact}>
              <Text style={[type.headlineSm, { color: colors.primary }]}>Prefer to chat?</Text>
              <Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]}>Message us on WhatsApp and we&apos;ll help you place your order.</Text>
              <Button label="Chat & Order on WhatsApp" icon="chat" onPress={() => void Linking.openURL(wa)} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg },
  hero: { paddingHorizontal: spacing.lg, gap: spacing.md, alignItems: "flex-start" },
  logo: { width: 72, height: 72 },
  trust: { flexDirection: "row", justifyContent: "space-around", gap: spacing.sm, marginHorizontal: spacing.lg, backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.md },
  trustItem: { flex: 1, alignItems: "center", gap: spacing.xs },
  cat: { width: 92, alignItems: "center", gap: spacing.xs },
  catImg: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.surfaceLow },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  why: { backgroundColor: colors.primary, padding: spacing.xl, gap: spacing.lg },
  whyCard: { backgroundColor: colors.primaryContainer, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
  contact: { backgroundColor: colors.primaryFixed, borderRadius: radii.lg, padding: spacing.xl, gap: spacing.md },
});
