import * as Network from "expo-network";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import {
  clearGuestCart,
  fetchCart,
  loadGuestCart,
  rpcAdd,
  rpcClear,
  rpcMerge,
  rpcNote,
  rpcRemove,
  rpcSet,
  saveGuestCart,
} from "@/lib/cartApi";
import { addLine, cartCount, cartSubtotal, EMPTY_CART, lineFromProduct, NOTE_MAX, removeLine, setLineQuantity, variantLimit } from "@/lib/cartLogic";
import { friendlyRpcError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import type { Cart, Product, Variant } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { useToast } from "./ToastProvider";

type CartApi = {
  cart: Cart;
  count: number;
  subtotalKobo: number;
  loading: boolean;
  /** "Add" button: adds `quantity` (delta). */
  add: (product: Product, variant: Variant, quantity?: number) => void;
  /** Stepper: absolute quantity; <= 0 removes. */
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  setNote: (note: string) => void;
  clear: () => void;
  refetch: () => void;
};

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [loading, setLoading] = useState(true);
  const cartRef = useRef(cart);

  // Serialised write queue: writes reach the server in the order the user made them.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeUser = useRef<string | null>(null);
  useEffect(() => {
    activeUser.current = userId;
  }, [userId]);

  const refetchNow = useCallback(async () => {
    if (!activeUser.current || pending.current > 0) return; // ignore refetches while writes are pending
    try {
      const next = await fetchCart();
      if (pending.current > 0 || !activeUser.current) return; // a write started meanwhile: discard stale read
      setCart(next);
    } catch {
      // keep the current view; the next signal/foreground/reconnect re-reads
    }
  }, []);

  const scheduleRefetch = useCallback(
    (delay: number) => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => void refetchNow(), delay);
    },
    [refetchNow],
  );

  const enqueue = useCallback(
    (op: () => Promise<unknown>) => {
      pending.current += 1;
      queue.current = queue.current
        .then(async () => {
          try {
            await op();
          } catch (e) {
            toast.show(friendlyRpcError(e instanceof Error ? e.message : undefined));
          }
        })
        .then(() => {
          pending.current -= 1;
          if (pending.current === 0) void refetchNow(); // converge once when the queue drains
        });
    },
    [refetchNow, toast],
  );

  // ---- Session changes: guest cart <-> database cart
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function start() {
      if (!userId) {
        const guest = await loadGuestCart();
        if (!cancelled) {
          setCart(guest);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      // sign-in: merge_cart -> clear local -> get_cart -> subscribe
      const guest = await loadGuestCart();
      if (guest.items.length > 0 || guest.note) {
        try {
          await rpcMerge(guest);
          await clearGuestCart();
        } catch {
          toast.show("We couldn't merge your guest cart. It's still saved on this device.");
        }
      }
      try {
        const next = await fetchCart();
        if (!cancelled) setCart(next);
      } catch {
        if (!cancelled) toast.show("Couldn't load your cart. Pull to retry.");
      }
      if (cancelled) return;
      setLoading(false);
      channel = supabase
        .channel(`cart-${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "carts", filter: `user_id=eq.${userId}` }, () => scheduleRefetch(150)) // signal only
        .subscribe((status) => {
          if (status === "SUBSCRIBED") scheduleRefetch(0);
        });
    }

    void start();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, authLoading, scheduleRefetch, toast]);

  // ---- Catch-up: foreground + connectivity restored
  useEffect(() => {
    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") scheduleRefetch(0);
    });
    const netSub = Network.addNetworkStateListener((s) => {
      if (s.isConnected && s.isInternetReachable !== false) scheduleRefetch(0);
    });
    return () => {
      appSub.remove();
      netSub.remove();
    };
  }, [scheduleRefetch]);

  // ---- Guest persistence (signed-in carts are never stored locally)
  const persistGuest = useCallback((next: Cart) => {
    if (!activeUser.current) void saveGuestCart(next);
  }, []);

  const apply = useCallback(
    (next: Cart) => {
      setCart(next);
      cartRef.current = next;
      persistGuest(next);
    },
    [persistGuest],
  );

  const add = useCallback<CartApi["add"]>(
    (product, variant, quantity = 1) => {
      if (variantLimit(variant) < 1) return toast.show("Sorry, that item is out of stock.");
      const line = lineFromProduct(product, variant, quantity);
      const before = cartRef.current.items.find((l) => l.variantId === variant.id);
      if (before && before.quantity >= before.maxPerOrder) return toast.show(`You've reached the limit of ${before.maxPerOrder} for this item.`);
      apply(addLine(cartRef.current, line, quantity));
      if (userId) enqueue(() => rpcAdd(variant.id, quantity));
      toast.show("Added to cart");
    },
    [apply, enqueue, toast, userId],
  );

  const setQuantity = useCallback<CartApi["setQuantity"]>(
    (variantId, quantity) => {
      apply(setLineQuantity(cartRef.current, variantId, quantity));
      if (userId) enqueue(() => rpcSet(variantId, quantity));
    },
    [apply, enqueue, userId],
  );

  const remove = useCallback<CartApi["remove"]>(
    (variantId) => {
      apply(removeLine(cartRef.current, variantId));
      if (userId) enqueue(() => rpcRemove(variantId));
    },
    [apply, enqueue, userId],
  );

  const setNote = useCallback<CartApi["setNote"]>(
    (note) => {
      const trimmed = note.slice(0, NOTE_MAX);
      apply({ ...cartRef.current, note: trimmed });
      if (!userId) return;
      if (noteTimer.current) clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => enqueue(() => rpcNote(trimmed)), 700);
    },
    [apply, enqueue, userId],
  );

  const clear = useCallback(() => {
    apply(EMPTY_CART);
    if (userId) enqueue(() => rpcClear());
  }, [apply, enqueue, userId]);

  const value = useMemo<CartApi>(
    () => ({
      cart,
      count: cartCount(cart),
      subtotalKobo: cartSubtotal(cart),
      loading: loading || authLoading,
      add,
      setQuantity,
      remove,
      setNote,
      clear,
      refetch: () => scheduleRefetch(0),
    }),
    [cart, loading, authLoading, add, setQuantity, remove, setNote, clear, scheduleRefetch],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
