import { Controller, type Control, type FieldPath } from "react-hook-form";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import type { CheckoutValues } from "@/lib/validators";
import { colors, radii, spacing, type } from "@/theme";

export function FormField({
  control,
  name,
  label,
  serverError,
  ...input
}: { control: Control<CheckoutValues>; name: FieldPath<CheckoutValues>; label: string; serverError?: string } & Omit<TextInputProps, "value" | "onChangeText">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const error = fieldState.error?.message ?? serverError;
        return (
          <View style={{ gap: spacing.xs }}>
            <Text style={[type.labelMd, { color: colors.onSurfaceVariant }]}>{label}</Text>
            <TextInput
              {...input}
              value={String(field.value ?? "")}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              accessibilityLabel={label}
              placeholderTextColor={colors.outline}
              style={[type.bodyMd, styles.input, error ? { borderColor: colors.error } : null]}
            />
            {error ? <Text style={[type.bodySm, { color: colors.error }]} accessibilityRole="alert">{error}</Text> : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radii.md, paddingHorizontal: spacing.md, backgroundColor: colors.card, color: colors.onSurface },
});
