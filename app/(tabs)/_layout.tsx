import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useCart } from "@/providers/CartProvider";
import { colors, fonts } from "@/theme";

export default function TabsLayout() {
  const { count } = useCart();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.heading, color: colors.primary },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.outline,
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.outlineVariant },
        tabBarBadgeStyle: { backgroundColor: colors.secondary, color: colors.onPrimary },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", headerShown: false, tabBarIcon: ({ color, size }) => <MaterialIcons name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="shop" options={{ title: "Shop", tabBarIcon: ({ color, size }) => <MaterialIcons name="storefront" color={color} size={size} /> }} />
      <Tabs.Screen
        name="cart"
        options={{ title: "Cart", tabBarBadge: count > 0 ? count : undefined, tabBarIcon: ({ color, size }) => <MaterialIcons name="shopping-cart" color={color} size={size} /> }}
      />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: ({ color, size }) => <MaterialIcons name="receipt-long" color={color} size={size} /> }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color, size }) => <MaterialIcons name="person" color={color} size={size} /> }} />
    </Tabs>
  );
}
