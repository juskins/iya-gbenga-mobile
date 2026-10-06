import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { FilterSheet } from "@/components/FilterSheet";
import { ProductCard } from "@/components/ProductCard";
import { Chip, ErrorState, IconButton, OfflineBanner, Skeleton, StateView } from "@/components/ui";
import { useCategories, useProducts } from "@/hooks/queries";
import { useOnline } from "@/hooks/useOnline";
import { DEFAULT_FILTERS, filterAndSort, type CatalogFilters } from "@/lib/catalog";
import { colors, radii, spacing, type } from "@/theme";

const PAGE = 12;
const SUGGESTIONS = ["Palm oil", "Yam", "Crayfish", "Garri"];

export default function Shop() {
  const params = useLocalSearchParams<{ category?: string }>();
  const products = useProducts();
  const categories = useCategories();
  const online = useOnline(() => void products.refetch());

  const [filters, setFiltersRaw] = useState<CatalogFilters>({ ...DEFAULT_FILTERS, categorySlugs: params.category ? [params.category] : [] });
  const setFilters = (update: (f: CatalogFilters) => CatalogFilters) => {
    setFiltersRaw(update);
    setVisibleCount(PAGE);
  };
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const [seenCategory, setSeenCategory] = useState(params.category);
  if (params.category !== seenCategory) {
    setSeenCategory(params.category);
    if (params.category) setFilters((f) => ({ ...f, categorySlugs: [params.category as string] }));
  }

  // 300 ms debounce on the search box
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, query: search })), 300);
    return () => clearTimeout(t);
  }, [search]);

  const results = useMemo(() => filterAndSort(products.data ?? [], filters), [products.data, filters]);

  const activeFilterCount = filters.categorySlugs.length + (filters.maxPriceKobo !== null ? 1 : 0) + (filters.inStockOnly ? 1 : 0) + (filters.sort !== "featured" ? 1 : 0);
  const reset = () => {
    setSearch("");
    setFilters(() => DEFAULT_FILTERS);
  };

  return (
    <View style={styles.screen}>
      {!online ? <OfflineBanner /> : null}
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <MaterialIcons name="search" size={20} color={colors.outline} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search groceries"
            placeholderTextColor={colors.outline}
            style={[type.bodyMd, styles.input]}
            accessibilityLabel="Search groceries"
            returnKeyType="search"
          />
          {search ? <IconButton icon="close" label="Clear search" size={18} onPress={() => setSearch("")} /> : null}
        </View>
        <View>
          <IconButton icon="tune" label="Filter and sort" color={colors.primary} onPress={() => setSheet(true)} />
          {activeFilterCount > 0 ? (
            <View style={styles.dot}>
              <Text style={styles.dotText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {products.isLoading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={250} width="48%" />
          ))}
        </View>
      ) : products.isError ? (
        <ErrorState onRetry={() => void products.refetch()} />
      ) : (
        <FlatList
          data={results.slice(0, visibleCount)}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <ProductCard product={item} />}
          onEndReached={() => setVisibleCount((n) => n + PAGE)}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={() => void products.refetch()} tintColor={colors.primary} />}
          ListHeaderComponent={
            <Text style={[type.bodySm, { color: colors.onSurfaceVariant }]}>
              {results.length} {results.length === 1 ? "item" : "items"}
            </Text>
          }
          ListEmptyComponent={
            <StateView
              icon="shopping-basket"
              title={filters.query ? `No groceries matched "${filters.query}"` : "No groceries matched"}
              message="Try a different search or clear your filters."
              actionLabel="Reset filters"
              onAction={reset}
            >
              <View style={styles.suggest}>
                {SUGGESTIONS.map((s) => (
                  <Chip key={s} label={s} onPress={() => setSearch(s)} />
                ))}
              </View>
            </StateView>
          }
        />
      )}

      <FilterSheet
        visible={sheet}
        filters={filters}
        categories={categories.data ?? []}
        onApply={(next) => {
          setFilters(() => ({ ...next, query: filters.query }));
          setSheet(false);
        }}
        onClose={() => setSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  search: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radii.pill, paddingLeft: spacing.lg, minHeight: 48, borderWidth: 1, borderColor: colors.outlineVariant },
  input: { flex: 1, color: colors.onSurface, paddingVertical: 8 },
  dot: { position: "absolute", top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  dotText: { ...type.labelCaps, fontSize: 10, color: colors.onPrimary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  skeletons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, padding: spacing.lg },
  suggest: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" },
});
