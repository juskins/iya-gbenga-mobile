// Single source of design tokens. Values come from the tailwind-config block of designs/*/code.html.
export const colors = {
  background: "#f8f9ff",
  surfaceLow: "#eff4ff",
  surface: "#e6eeff",
  surfaceHigh: "#dee9fc",
  card: "#ffffff",
  primary: "#00361f",
  primaryContainer: "#164e33",
  primaryFixed: "#b6f0ca",
  primaryFixedDim: "#9ad3af",
  onPrimary: "#ffffff",
  secondary: "#944a00",
  secondaryContainer: "#fc8f34",
  secondaryFixed: "#ffdcc5",
  tertiary: "#003809",
  onSurface: "#121c2a",
  onSurfaceVariant: "#404942",
  outline: "#717972",
  outlineVariant: "#c0c9c0",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  inverseSurface: "#27313f",
  inverseOnSurface: "#ffffff",
} as const;

export const fonts = {
  heading: "PlusJakartaSans_700Bold",
  headingSemi: "PlusJakartaSans_600SemiBold",
  headingXBold: "PlusJakartaSans_800ExtraBold",
  body: "Inter_400Regular",
  bodySemi: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radii = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const TOUCH_TARGET = 44;

export const type = {
  displayHero: { fontFamily: fonts.headingXBold, fontSize: 36, lineHeight: 44 },
  headlineXl: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 36 },
  headlineLg: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 32 },
  headlineSm: { fontFamily: fonts.headingSemi, fontSize: 20, lineHeight: 28 },
  titleMd: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 24 },
  bodyLg: { fontFamily: fonts.body, fontSize: 18, lineHeight: 28 },
  bodyMd: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodySm: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  labelMd: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 16 },
  labelCaps: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.66, textTransform: "uppercase" as const },
  priceCard: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 22 },
  priceXl: { fontFamily: fonts.bodyBold, fontSize: 24, lineHeight: 30 },
} as const;

export const shadow = {
  shadowColor: "#121c2a",
  shadowOpacity: 0.08,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

export type BadgeTone = "secondary" | "primary" | "tertiary" | "orange" | "error" | "mint";

export const badgeStyles: Record<BadgeTone, { bg: string; fg: string }> = {
  secondary: { bg: colors.secondaryFixed, fg: colors.secondary },
  primary: { bg: colors.primaryContainer, fg: colors.onPrimary },
  tertiary: { bg: colors.tertiary, fg: colors.onPrimary },
  orange: { bg: colors.secondaryContainer, fg: colors.onSurface },
  error: { bg: colors.error, fg: colors.onPrimary },
  mint: { bg: colors.primaryFixed, fg: colors.primary },
};
