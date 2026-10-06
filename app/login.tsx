import { Image } from "expo-image";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing, type } from "@/theme";

export default function Login() {
  const { user, signInWithGoogle } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Return to where the user was once signed in.
  useEffect(() => {
    if (user) router.replace((next as Href | undefined) ?? "/");
  }, [user, next]);

  const onPress = async () => {
    setBusy(true);
    setError(null);
    const result = await signInWithGoogle();
    setBusy(false);
    if (result.error) setError(result.error);
  };

  return (
    <View style={styles.screen}>
      <Image source={require("../assets/logo.png")} style={styles.logo} contentFit="contain" accessibilityLabel="Iya Gbenga's Store" />
      <Text style={[type.headlineXl, styles.center]}>Welcome back</Text>
      <Text style={[type.bodyMd, styles.center, { color: colors.onSurfaceVariant }]}>
        Sign in to check out, track your orders and keep your cart in sync with the website.
      </Text>
      <Button label="Continue with Google" icon="login" onPress={onPress} loading={busy} style={{ alignSelf: "stretch" }} />
      {error ? <Text style={[type.bodySm, styles.center, { color: colors.error }]} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, alignItems: "center", justifyContent: "center", gap: spacing.lg },
  logo: { width: 160, height: 160 },
  center: { textAlign: "center", color: colors.primary },
});
