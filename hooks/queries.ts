import { useQuery } from "@tanstack/react-query";
import { fetchStoreConfig } from "@/lib/api";
import { fetchCategories, fetchProducts, fetchShippingMethods } from "@/lib/catalog";
import { fetchDefaultAddress, fetchProfile } from "@/lib/account";
import { useAuth } from "@/providers/AuthProvider";

export const useProducts = () => useQuery({ queryKey: ["products"], queryFn: fetchProducts, staleTime: 60_000 });
export const useCategories = () => useQuery({ queryKey: ["categories"], queryFn: fetchCategories, staleTime: 5 * 60_000 });
export const useShippingMethods = () => useQuery({ queryKey: ["shipping"], queryFn: fetchShippingMethods, staleTime: 5 * 60_000 });

/** Website-side settings (WhatsApp number, bank details, free-delivery threshold). Fetched once signed in, then cached. */
export function useStoreConfig() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["store-config", user?.id], queryFn: fetchStoreConfig, enabled: !!user, staleTime: 10 * 60_000 });
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["profile", user?.id], queryFn: () => fetchProfile(user!.id), enabled: !!user });
}

export function useDefaultAddress() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["default-address", user?.id], queryFn: () => fetchDefaultAddress(user!.id), enabled: !!user });
}
