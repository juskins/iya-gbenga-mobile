import { zodResolver } from "@hookform/resolvers/zod";
import { randomUUID } from "expo-crypto";
import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { FormField } from "@/components/FormField";
import { Button, Chip, ErrorState, Skeleton } from "@/components/ui";
import { useDefaultAddress, useProfile, useShippingMethods, useStoreConfig } from "@/hooks/queries";
import { placeOrder, type ApiFailure } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { checkoutSchema, LAGOS_LGAS, stripPhone, type CheckoutValues } from "@/lib/validators";
import { useAuth } from "@/providers/AuthProvider";
import { useCart } from "@/providers/CartProvider";
import { colors, radii, spacing, type } from "@/theme";

const STEPS = ["Delivery", "Shipping", "Review"] as const;
const STEP_FIELDS: (keyof CheckoutValues)[][] = [
  ["firstName", "lastName", "email", "phone", "street", "unit", "state", "lga", "landmark"],
  ["shippingMethod", "paymentMethod"],
  [],
];

export default function Checkout() {
  const { user, loading: authLoading } = useAuth();
  const { cart, subtotalKobo, clear, loading: cartLoading } = useCart();
  const profile = useProfile();
  const address = useDefaultAddress();
  const shipping = useShippingMethods();
  const config = useStoreConfig();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const idempotencyKey = useRef(randomUUID()); // once per checkout attempt; reused on retries / double taps
  const inFlight = useRef(false);
  const [placed, setPlaced] = useState(false);

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    mode: "onTouched",
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", street: "", unit: "", state: "Lagos", lga: undefined, landmark: "", shippingMethod: "", paymentMethod: "pay_on_delivery", saveAsDefault: false },
  });

  // Prefill from profile + default address once loaded (without overwriting what the user typed).
  useEffect(() => {
    const p = profile.data;
    const a = address.data;
    const [first = "", ...rest] = (p?.fullName ?? "").split(" ");
    const set = (name: keyof CheckoutValues, value: string | null | undefined) => {
      if (value && !form.getFieldState(name).isDirty) form.setValue(name, value as never);
    };
    set("firstName", first);
    set("lastName", rest.join(" "));
    set("email", p?.email ?? user?.email);
    set("phone", a?.phone ?? p?.phone);
    set("street", a?.street);
    set("unit", a?.unit);
    set("landmark", a?.landmark);
    if (a?.lga && (LAGOS_LGAS as readonly string[]).includes(a.lga)) set("lga", a.lga);
  }, [profile.data, address.data, user?.email, form]);

  useEffect(() => {
    const first = shipping.data?.[0];
    if (first && !form.getValues("shippingMethod")) form.setValue("shippingMethod", first.id);
  }, [shipping.data, form]);

  const selectedId = useWatch({ control: form.control, name: "shippingMethod" });
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" });
  const method = shipping.data?.find((m) => m.id === selectedId);
  const deliveryKobo = method ? (method.freeAboveKobo !== null && subtotalKobo >= method.freeAboveKobo ? 0 : method.priceKobo) : 0;
  const estimateTotal = subtotalKobo + deliveryKobo;
  const hasUnavailable = useMemo(() => cart.items.some((l) => l.available === false), [cart.items]);

  if (authLoading || cartLoading) return <Skeleton height={300} style={{ margin: spacing.lg }} />;
  if (!user) return <Redirect href={{ pathname: "/login", params: { next: "/checkout" } }} />;
  if (cart.items.length === 0 && !placed) return <Redirect href="/cart" />;

  const next = async () => {
    if (await form.trigger(STEP_FIELDS[step])) setStep(step + 1);
  };

  async function onValid(values: CheckoutValues) {
    if (inFlight.current || hasUnavailable) return; // double-submit protection
    inFlight.current = true;
    setSubmitting(true);
    setFailure(null);
    const result = await placeOrder({
      values: { ...values, phone: stripPhone(values.phone) },
      idempotencyKey: idempotencyKey.current,
      items: cart.items.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      note: cart.note,
    });
    inFlight.current = false;
    setSubmitting(false);

    if (result.ok) {
      setPlaced(true);
      idempotencyKey.current = randomUUID(); // rotate only after success
      clear();
      router.replace(`/order-confirmation/${result.orderNumber}`);
      return;
    }
    setFailure(result); // keep cart and form values; show the server's message / field errors
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) form.setError(field as keyof CheckoutValues, { message });
      setStep(0);
    }
  }
  const submit = () => form.handleSubmit(onValid)();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <Text key={s} style={[type.labelCaps, { color: i === step ? colors.primary : colors.outline }]}>{i + 1}. {s}</Text>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <>
            <FormField control={form.control} name="firstName" label="First name" autoComplete="given-name" />
            <FormField control={form.control} name="lastName" label="Last name" autoComplete="family-name" />
            <FormField control={form.control} name="email" label="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <FormField control={form.control} name="phone" label="Phone" keyboardType="phone-pad" placeholder="0803 456 7890" autoComplete="tel" />
            <FormField control={form.control} name="street" label="Street address" autoComplete="street-address" />
            <FormField control={form.control} name="unit" label="Apartment / unit (optional)" />
            <View style={{ gap: spacing.xs }}>
              <Text style={[type.labelMd, { color: colors.onSurfaceVariant }]}>State</Text>
              <Text style={[type.bodyMd, styles.readonly]}>Lagos</Text>
              <Text style={[type.bodySm, { color: colors.outline }]}>We only deliver within Lagos for now.</Text>
            </View>
            <Controller
              control={form.control}
              name="lga"
              render={({ field, fieldState }) => (
                <View style={{ gap: spacing.sm }}>
                  <Text style={[type.labelMd, { color: colors.onSurfaceVariant }]}>Area</Text>
                  <View style={styles.wrap}>
                    {LAGOS_LGAS.map((l) => (
                      <Chip key={l} label={l} selected={field.value === l} onPress={() => field.onChange(l)} />
                    ))}
                  </View>
                  {fieldState.error ? <Text style={[type.bodySm, { color: colors.error }]} accessibilityRole="alert">{fieldState.error.message}</Text> : null}
                </View>
              )}
            />
            <FormField control={form.control} name="landmark" label="Landmark (optional)" />
            <Controller
              control={form.control}
              name="saveAsDefault"
              render={({ field }) => (
                <View style={styles.switchRow}>
                  <Text style={[type.bodyMd, { flex: 1, color: colors.onSurface }]}>Save as my default address</Text>
                  <Switch value={field.value} onValueChange={field.onChange} trackColor={{ true: colors.primaryContainer }} accessibilityLabel="Save as my default address" />
                </View>
              )}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={type.headlineSm}>Delivery method</Text>
            {shipping.isLoading ? <Skeleton height={80} /> : shipping.isError ? <ErrorState onRetry={() => void shipping.refetch()} /> : null}
            {(shipping.data ?? []).map((m) => {
              const free = m.freeAboveKobo !== null && subtotalKobo >= m.freeAboveKobo;
              return (
                <Pressable
                  key={m.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: m.id === selectedId }}
                  onPress={() => form.setValue("shippingMethod", m.id)}
                  style={[styles.option, m.id === selectedId && styles.optionOn]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[type.titleMd, { color: colors.onSurface }]}>{m.name}</Text>
                    {m.etaText ? <Text style={[type.bodySm, { color: colors.onSurfaceVariant }]}>{m.etaText}</Text> : null}
                    {m.cutoffTime ? <Text style={[type.bodySm, { color: colors.outline }]}>Order before {m.cutoffTime}</Text> : null}
                  </View>
                  <Text style={[type.priceCard, { color: free ? colors.primaryContainer : colors.onSurface }]}>{free ? "Free" : formatNaira(m.priceKobo)}</Text>
                </Pressable>
              );
            })}
            <Text style={type.headlineSm}>Payment</Text>
            {(
              [
                ["pay_on_delivery", "Pay on Delivery", "Pay in cash or by transfer when your order arrives."],
                ["bank_transfer", "Bank Transfer", "We'll show our account details after you place the order."],
              ] as const
            ).map(([value, title, hint]) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: paymentMethod === value }}
                onPress={() => form.setValue("paymentMethod", value)}
                style={[styles.option, paymentMethod === value && styles.optionOn]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[type.titleMd, { color: colors.onSurface }]}>{title}</Text>
                  <Text style={[type.bodySm, { color: colors.onSurfaceVariant }]}>{hint}</Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={type.headlineSm}>Review your order</Text>
            {cart.items.map((l) => (
              <View key={l.variantId} style={styles.reviewRow}>
                <Text style={[type.bodyMd, { flex: 1, color: colors.onSurface }]}>{l.quantity} × {l.name} ({l.variantLabel})</Text>
                <Text style={[type.titleMd, { color: colors.onSurface }]}>{formatNaira(l.unitPriceKobo * l.quantity)}</Text>
              </View>
            ))}
            <View style={styles.totals}>
              <Row label="Subtotal" value={formatNaira(subtotalKobo)} />
              <Row label={`Delivery${method ? ` (${method.name})` : ""}`} value={deliveryKobo === 0 ? "Free" : formatNaira(deliveryKobo)} />
              <Row label="Total" value={formatNaira(estimateTotal)} strong />
              <Text style={[type.bodySm, { color: colors.outline }]}>The final total is confirmed by the store when you place the order.</Text>
            </View>
            <Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]}>
              Payment: {paymentMethod === "bank_transfer" ? "Bank Transfer" : "Pay on Delivery"}
              {paymentMethod === "bank_transfer" && config.data?.bankTransfer === null ? " (we'll contact you with payment details)" : ""}
            </Text>
            {failure ? (
              <View style={styles.failure} accessibilityRole="alert">
                <Text style={[type.bodyMd, { color: colors.error }]}>{failure.message}</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <View style={styles.bar}>
        {step > 0 ? <Button label="Back" variant="secondary" onPress={() => setStep(step - 1)} /> : null}
        {step < 2 ? (
          <Button label="Continue" onPress={() => void next()} style={{ flex: 1 }} />
        ) : (
          <Button label={`Place Order · ${formatNaira(estimateTotal)}`} onPress={() => void submit()} loading={submitting} disabled={hasUnavailable} style={{ flex: 1 }} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={[strong ? type.titleMd : type.bodyMd, { color: colors.onSurface }]}>{label}</Text>
      <Text style={[strong ? type.priceCard : type.titleMd, { color: strong ? colors.primary : colors.onSurface }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: "row", justifyContent: "space-around", paddingVertical: spacing.md },
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  readonly: { minHeight: 48, textAlignVertical: "center", paddingHorizontal: spacing.md, paddingTop: 13, backgroundColor: colors.surfaceLow, borderRadius: radii.md, color: colors.onSurfaceVariant },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  option: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1.5, borderColor: colors.outlineVariant },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primaryFixed },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  totals: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
  failure: { backgroundColor: colors.errorContainer, borderRadius: radii.md, padding: spacing.md },
  bar: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
});
