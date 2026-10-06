import { supabase } from "./supabase";

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export type ApiFailure = {
  ok: false;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  status: number;
};

export type OrderRequest = {
  values: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    street: string;
    unit: string;
    state: string;
    lga: string;
    landmark: string;
    shippingMethod: string;
    paymentMethod: "pay_on_delivery" | "bank_transfer";
    saveAsDefault: boolean;
  };
  idempotencyKey: string;
  items: { variantId: string; quantity: number }[];
  note: string;
};

export type OrderSuccess = { ok: true; orderNumber: string; orderId: string; totalKobo: number };

export type StoreConfig = {
  whatsappNumber: string | null;
  supportPhone: string;
  freeDeliveryThresholdKobo: number;
  bankTransfer: { bankName: string; accountNumber: string; accountName: string } | null;
};

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function send(path: string, init: RequestInit, token: string | null): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

/** Authenticated call to the website API. If the token is rejected, refresh the session and retry once. */
async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let res = await send(path, init, await accessToken());
  if (res.status === 401) {
    const { data } = await supabase.auth.refreshSession();
    if (data.session) res = await send(path, init, data.session.access_token);
  }
  return res;
}

const networkFailure: ApiFailure = {
  ok: false,
  code: "NETWORK",
  message: "We couldn't reach the store. Check your connection and try again.",
  status: 0,
};

export async function placeOrder(body: OrderRequest): Promise<OrderSuccess | ApiFailure> {
  try {
    const res = await authedFetch("/api/orders", { method: "POST", body: JSON.stringify(body) });
    const json: unknown = await res.json().catch(() => null);
    if (res.ok && isRecord(json) && json.ok === true) return json as OrderSuccess;
    const fail = isRecord(json) ? json : {};
    return {
      ok: false,
      code: typeof fail.code === "string" ? fail.code : "UNKNOWN",
      message: typeof fail.message === "string" ? fail.message : "Something went wrong. Please try again.",
      fieldErrors: isRecord(fail.fieldErrors) ? (fail.fieldErrors as Record<string, string>) : undefined,
      status: res.status,
    };
  } catch {
    return networkFailure;
  }
}

export async function fetchStoreConfig(): Promise<StoreConfig> {
  const res = await authedFetch("/api/store-config");
  const json: unknown = await res.json();
  if (!res.ok || !isRecord(json) || json.ok !== true) throw new Error("Could not load store settings");
  return json as unknown as StoreConfig;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function whatsappLink(number: string | null, message: string): string | null {
  const digits = number?.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}
