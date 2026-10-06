import { MaterialIcons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { badgeStyles, colors, radii, spacing, TOUCH_TARGET, type, type BadgeTone } from "@/theme";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: ViewStyle;
}) {
  const fg = variant === "primary" ? colors.onPrimary : colors.primary;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && { backgroundColor: colors.primary },
        variant === "secondary" && { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primary },
        variant === "ghost" && { backgroundColor: "transparent" },
        inactive && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <MaterialIcons name={icon} size={20} color={fg} /> : null}
      <Text style={[type.titleMd, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, size = 24, color = colors.onSurface }: { icon: IconName; label: string; onPress: () => void; size?: number; color?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={styles.iconButton}>
      <MaterialIcons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Badge({ text, tone = "mint" }: { text: string; tone?: BadgeTone }) {
  const s = badgeStyles[tone];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[type.labelCaps, { color: s.fg }]}>{text}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceLow }]}
    >
      <Text style={[type.labelMd, { color: selected ? colors.onPrimary : colors.onSurfaceVariant }]}>{label}</Text>
    </Pressable>
  );
}

export function Stepper({ value, max, onChange, label }: { value: number; max: number; onChange: (next: number) => void; label: string }) {
  return (
    <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel={`${label} quantity ${value}`}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} onPress={() => onChange(value - 1)} style={styles.stepBtn}>
        <MaterialIcons name={value <= 1 ? "delete-outline" : "remove"} size={20} color={colors.primary} />
      </Pressable>
      <Text style={[type.titleMd, styles.stepValue]}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        accessibilityState={{ disabled: value >= max }}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={[styles.stepBtn, value >= max && { opacity: 0.35 }]}
      >
        <MaterialIcons name="add" size={20} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export function Skeleton({ height, width, style }: { height: number; width?: number | `${number}%`; style?: ViewStyle }) {
  return <View accessibilityElementsHidden style={[{ height, width: width ?? "100%", backgroundColor: colors.surface, borderRadius: radii.md }, style]} />;
}

export function StateView({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  children,
}: {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <MaterialIcons name={icon} size={28} color={colors.secondary} />
      </View>
      <Text style={[type.headlineSm, styles.center]}>{title}</Text>
      {message ? <Text style={[type.bodyMd, styles.center, { color: colors.onSurfaceVariant }]}>{message}</Text> : null}
      {children}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export const ErrorState = ({ onRetry, message }: { onRetry: () => void; message?: string }) => (
  <StateView icon="cloud-off" title="Something went wrong" message={message ?? "We couldn't load this. Check your connection and try again."} actionLabel="Try again" onAction={onRetry} />
);

export function OfflineBanner() {
  return (
    <View style={styles.offline} accessibilityRole="alert">
      <MaterialIcons name="wifi-off" size={16} color={colors.onPrimary} />
      <Text style={[type.labelMd, { color: colors.onPrimary }]}>You&apos;re offline. Showing what we last loaded.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: TOUCH_TARGET + 4, borderRadius: radii.pill, paddingHorizontal: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  iconButton: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
  badge: { alignSelf: "flex-start", borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  chip: { minHeight: 36, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radii.pill },
  stepper: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceLow, borderRadius: radii.pill },
  stepBtn: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
  stepValue: { minWidth: 28, textAlign: "center", color: colors.onSurface },
  state: { alignItems: "center", gap: spacing.md, padding: spacing.xxl },
  stateIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.secondaryFixed, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center", color: colors.onSurface },
  offline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.inverseSurface, paddingVertical: spacing.sm },
});
