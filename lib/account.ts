import { supabase } from "./supabase";

export type Profile = { fullName: string | null; email: string | null; phone: string | null; avatarUrl: string | null };

export type SavedAddress = { street: string; unit: string | null; state: string; lga: string; landmark: string | null; phone: string | null };

// The app may read and update only full_name, phone and avatar_url; it never touches `role`.
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("full_name, email, phone, avatar_url").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { fullName: data.full_name, email: data.email, phone: data.phone, avatarUrl: data.avatar_url } : null;
}

export async function fetchDefaultAddress(userId: string): Promise<SavedAddress | null> {
  const { data, error } = await supabase
    .from("addresses")
    .select("street, unit, state, lga, landmark, phone")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
