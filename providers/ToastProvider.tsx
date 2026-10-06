import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing, type } from "@/theme";

type ToastApi = { show: (message: string) => void };

const ToastContext = createContext<ToastApi>({ show: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), 2500);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {message ? (
        <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 96 }]} accessibilityLiveRegion="polite">
          <View style={styles.toast}>
            <Text style={styles.text}>{message}</Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = (): ToastApi => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center" },
  toast: { backgroundColor: colors.inverseSurface, borderRadius: radii.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  text: { ...type.labelMd, color: colors.inverseOnSurface },
});
