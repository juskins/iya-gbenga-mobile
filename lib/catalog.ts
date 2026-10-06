import type { BadgeTone } from "@/theme";
import { variantLimit } from "./cartLogic";
import { supabase } from "./supabase";
import type { Category, Product, ShippingMethod, Variant } from "./types";

type Row = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  origin: string | null;
  badge: string | null;
  badge_tone: BadgeTone | null;
  created_at: string;
  category: { slug: string; name: string } | null;
  variants: {
    id: string;
    label: string;
    sku: string | null;
    price_kobo: number;
    compare_at_price_kobo: number | null;
    stock_qty: number;
    max_per_order: number;
  }[];
  images: { url: string; sort_order: number }[];
  related: { related_product_id: string }[];
};

/** A product is shown only with >=1 variant and >=1 image. Variants sort by price. */
export function mapProducts(rows: Row[]): Product[] {
  return rows
    .filter((r) => r.variants.length > 0 && r.images.length > 0)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      origin: r.origin,
      badge: r.badge,
      badgeTone: r.badge_tone,
      createdAt: r.created_at,
      categorySlug: r.category?.slug ?? "",
      categoryName: r.category?.name ?? "",
      variants: r.variants
        .map<Variant>((v) => ({
          id: v.id,
          label: v.label,
          sku: v.sku,
          priceKobo: v.price_kobo,
          compareAtPriceKobo: v.compare_at_price_kobo,
          stockQty: v.stock_qty,
          maxPerOrder: v.max_per_order,
        }))
        .sort((a, b) => a.priceKobo - b.priceKobo),
      images: [...r.images].sort((a, b) => a.sort_order - b.sort_order).map((i) => i.url),
      relatedIds: r.related.map((x) => x.related_product_id),
    }));
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, name, slug, description, origin, badge, badge_tone, created_at,
       category:categories(slug, name),
       variants:product_variants(id, label, sku, price_kobo, compare_at_price_kobo, stock_qty, max_per_order),
       images:product_images(url, sort_order),
       related:product_related!product_related_product_id_fkey(related_product_id)`,
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return mapProducts((data ?? []) as unknown as Row[]);
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("id, name, slug, image_url").eq("is_active", true).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug, imageUrl: c.image_url }));
}

export async function fetchShippingMethods(): Promise<ShippingMethod[]> {
  const { data, error } = await supabase
    .from("shipping_methods")
    .select("id, name, price_kobo, free_above_kobo, eta_text, cutoff_time")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    priceKobo: s.price_kobo,
    freeAboveKobo: s.free_above_kobo,
    etaText: s.eta_text,
    cutoffTime: s.cutoff_time,
  }));
}

// ---- Pure display helpers

/** Cheapest in-stock variant, falling back to the cheapest overall. */
export function displayVariant(p: Product): Variant {
  return p.variants.find((v) => variantLimit(v) > 0) ?? p.variants[0];
}

export const isSoldOut = (p: Product): boolean => p.variants.every((v) => variantLimit(v) < 1);
export const hasMultiplePrices = (p: Product): boolean => p.variants.length > 1;

export type SortKey = "featured" | "price_asc" | "price_desc";

export type CatalogFilters = {
  query: string;
  categorySlugs: string[];
  maxPriceKobo: number | null;
  inStockOnly: boolean;
  sort: SortKey;
};

export const DEFAULT_FILTERS: CatalogFilters = { query: "", categorySlugs: [], maxPriceKobo: null, inStockOnly: false, sort: "featured" };

export function filterAndSort(products: Product[], f: CatalogFilters): Product[] {
  const q = f.query.trim().toLowerCase();
  const out = products.filter((p) => {
    if (q && !`${p.name} ${p.description ?? ""} ${p.categoryName}`.toLowerCase().includes(q)) return false;
    if (f.categorySlugs.length && !f.categorySlugs.includes(p.categorySlug)) return false;
    if (f.maxPriceKobo !== null && displayVariant(p).priceKobo > f.maxPriceKobo) return false;
    if (f.inStockOnly && isSoldOut(p)) return false;
    return true;
  });
  if (f.sort === "price_asc") out.sort((a, b) => displayVariant(a).priceKobo - displayVariant(b).priceKobo);
  if (f.sort === "price_desc") out.sort((a, b) => displayVariant(b).priceKobo - displayVariant(a).priceKobo);
  return out; // "featured" keeps the newest-first order from the query
}
