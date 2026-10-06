import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEFAULT_FILTERS, type CatalogFilters, type SortKey } from "@/lib/catalog";
import { formatNaira } from "@/lib/format";
import type { Category } from "@/lib/types";
import { colors, radii, spacing, type } from "@/theme";
import { Button, Chip } from "./ui";

const PRICE_CAPS = [null, 500000, 1000000, 2000000, 5000000] as const;
const SORTS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
];

export function FilterSheet({
  visible,
  filters,
  categories,
  onApply,
  onClose,
}: {
  visible: boolean;
  filters: CatalogFilters;
  categories: Category[];
  onApply: (next: CatalogFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(filters);
  const insets = useSafeAreaInsets();

  const toggleCategory = (slug: string) =>
    setDraft((d) => ({ ...d, categorySlugs: d.categorySlugs.includes(slug) ? d.categorySlugs.filter((s) => s !== slug) : [...d.categorySlugs, slug] }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={() => setDraft(filters)}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close filters" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={{ gap: spacing.lg }}>
          <Text style={type.headlineSm}>Filter & sort</Text>

          <Section title="Sort by">
            {SORTS.map((s) => (
              <Chip key={s.key} label={s.label} selected={draft.sort === s.key} onPress={() => setDraft({ ...draft, sort: s.key })} />
            ))}
          </Section>

          <Section title="Category">
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} selected={draft.categorySlugs.includes(c.slug)} onPress={() => toggleCategory(c.slug)} />
            ))}
          </Section>

          <Section title="Max price">
            {PRICE_CAPS.map((cap) => (
              <Chip key={cap ?? "any"} label={cap === null ? "Any" : `Up to ${formatNaira(cap)}`} selected={draft.maxPriceKobo === cap} onPress={() => setDraft({ ...draft, maxPriceKobo: cap })} />
            ))}
          </Section>

          <Section title="Availability">
            <Chip label="In stock only" selected={draft.inStockOnly} onPress={() => setDraft({ ...draft, inStockOnly: !draft.inStockOnly })} />
          </Section>
        </ScrollView>
        <View style={styles.actions}>
          <Button label="Reset" variant="secondary" style={{ flex: 1 }} onPress={() => setDraft({ ...DEFAULT_FILTERS, query: draft.query })} />
          <Button label="Apply" style={{ flex: 1 }} onPress={() => onApply(draft)} />
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[type.labelCaps, { color: colors.outline }]}>{title}</Text>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(18,28,42,0.45)" },
  sheet: { maxHeight: "80%", backgroundColor: colors.card, borderTopLeftRadius: radii.lg + 8, borderTopRightRadius: radii.lg + 8, padding: spacing.lg, gap: spacing.lg },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.outlineVariant },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.md },
});
