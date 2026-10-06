import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { useProfile, useStoreConfig } from "@/hooks/queries";
import { whatsappLink } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { colors, radii, spacing, TOUCH_TARGET, type } from "@/theme";

export default function Account() {
  const { user, signOut } = useAuth();
  const profile = useProfile();
  const config = useStoreConfig();

  if (!user) {
    return (
      <View style={styles.guest}>
        <MaterialIcons name="person-outline" size={48} color={colors.primary} />
        <Text style={[type.headlineSm, { textAlign: "center" }]}>Sign in to your account</Text>
        <Text style={[type.bodyMd, { textAlign: "center", color: colors.onSurfaceVariant }]}>Check out faster and see your orders on every device.</Text>
        <Button label="Continue with Google" icon="login" onPress={() => router.push("/login")} />
      </View>
    );
  }

  const name = profile.data?.fullName ?? (user.user_metadata?.full_name as string | undefined) ?? "Your account";
  const avatar = profile.data?.avatarUrl ?? (user.user_metadata?.avatar_url as string | undefined);
  const help = whatsappLink(config.data?.whatsappNumber ?? null, "Hello Iya Gbenga's Store, I need help.");

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} accessibilityLabel="Your profile photo" /> : <MaterialIcons name="account-circle" size={64} color={colors.primary} />}
        <View style={{ flexShrink: 1 }}>
          <Text style={[type.headlineSm, { color: colors.primary }]}>{name}</Text>
          <Text style={[type.bodyMd, { color: colors.onSurfaceVariant }]}>{user.email}</Text>
        </View>
      </View>
      <Row icon="receipt-long" label="My orders" onPress={() => router.push("/orders")} />
      {help ? <Row icon="chat" label="WhatsApp help" onPress={() => void Linking.openURL(help)} /> : null}
      <Row icon="logout" label="Sign out" onPress={() => void signOut()} />
      <Text style={[type.bodySm, styles.version]}>Version {Constants.expoConfig?.version}</Text>
    </View>
  );
}

function Row({ icon, label, onPress }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.row}>
      <MaterialIcons name={icon} size={22} color={colors.primary} />
      <Text style={[type.titleMd, { flex: 1, color: colors.onSurface }]}>{label}</Text>
      <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  guest: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, alignItems: "center", justifyContent: "center", gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingVertical: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  row: { minHeight: TOUCH_TARGET + 8, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radii.md, paddingHorizontal: spacing.lg },
  version: { textAlign: "center", color: colors.outline, marginTop: spacing.lg },
});
