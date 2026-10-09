/**
 * Design tokens — 1:1 port of the app's theme (ColorPrimitives.kt,
 * ColorContentSemantic.kt, ColorBrandSemantic.kt, Type.kt, Containers.kt)
 * via the Compose SDK module's theme/ package.
 */
import type { TextStyle } from 'react-native';
import type {
  FarmerChatTheme as FarmerChatThemeConfig,
  FarmerChatThemeColors,
  FarmerChatLogoSource,
} from '../core/config';

// ---------------------------------------------------------------------------
// Color primitives (ColorPrimitives.kt)
// ---------------------------------------------------------------------------

export const White = '#FFFFFF';
export const Black = '#000000';

// Neutral (Zinc)
export const Neutral50 = '#FAFAFA';
export const Neutral100 = '#F4F4F5';
export const Neutral150 = '#ECECEE';
export const Neutral200 = '#E4E4E7';
export const Neutral300 = '#D4D4D8';
export const Neutral400 = '#9F9FA9';
export const Neutral500 = '#71717B';
export const Neutral600 = '#52525C';
export const Neutral700 = '#3F3F46';
export const Neutral800 = '#27272A';
export const Neutral900 = '#18181B';
export const Neutral950 = '#09090B';

// Opacity ramp — Black
export const Black50 = 'rgba(0,0,0,0.5)';
export const Black60 = 'rgba(0,0,0,0.6)';

// Brand — Green
export const Green500 = '#00C950';
export const Green700 = '#008236';
export const Green800 = '#08361B';
export const Green950 = '#032E15';

// Brand — Green (Alpha)
export const Green500_8 = 'rgba(0,201,80,0.08)';
export const Green500_16 = 'rgba(0,201,80,0.16)';

// Sky / Sun / Red
export const Sky400 = '#00BCFF';
export const Sky700 = '#0069A8';
export const Sun300 = '#F9FF47';
export const Red500 = '#E5533D';

// ---------------------------------------------------------------------------
// Semantic colors
// ---------------------------------------------------------------------------

export interface BrandColors {
  surfacePrimary: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  foregroundPrimary: string;
  foregroundSecondary: string;
  feedbackSuccess: string;
  feedbackFail: string;
}

export const BrandSemanticColors: BrandColors = {
  surfacePrimary: Green700,
  surfaceSecondary: Green800,
  surfaceTertiary: Green950,
  foregroundPrimary: White,
  foregroundSecondary: Green500,
  feedbackSuccess: Green500,
  feedbackFail: Red500,
};

export interface ContentColors {
  surfacePrimary: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  surfaceActive: string;
  surfaceReadingPrimary: string;
  surfaceReadingSecondary: string;
  surfaceReadingTertiary: string;
  foregroundPrimary: string;
  foregroundSecondary: string;
  foregroundTertiary: string;
  buttonPrimarySurface: string;
  buttonPrimaryForeground: string;
  buttonPrimaryAccent: string;
  borderDefault: string;
  borderActive: string;
  formPlaceholder: string;
  scrim: string;
  shimmer: string;
  shine: string;
}

export const LightContentColors: ContentColors = {
  surfacePrimary: Neutral150,
  surfaceSecondary: White,
  surfaceTertiary: Neutral200,
  surfaceActive: Green500_16,
  surfaceReadingPrimary: White,
  surfaceReadingSecondary: Neutral150,
  surfaceReadingTertiary: White,
  foregroundPrimary: Black,
  foregroundSecondary: Neutral600,
  foregroundTertiary: Neutral300,
  buttonPrimarySurface: Green800,
  buttonPrimaryForeground: White,
  buttonPrimaryAccent: Green500,
  borderDefault: Neutral300,
  borderActive: Green500,
  formPlaceholder: Neutral500,
  scrim: Black50,
  shimmer: Neutral100,
  shine: Black,
};

export const DarkContentColors: ContentColors = {
  surfacePrimary: Neutral900,
  surfaceSecondary: Neutral800,
  surfaceTertiary: Neutral700,
  surfaceActive: Green500_16,
  surfaceReadingPrimary: Neutral900,
  surfaceReadingSecondary: Neutral800,
  surfaceReadingTertiary: Neutral900,
  foregroundPrimary: White,
  foregroundSecondary: Neutral400,
  foregroundTertiary: Neutral700,
  buttonPrimarySurface: Green700,
  buttonPrimaryForeground: White,
  buttonPrimaryAccent: Green500,
  borderDefault: Neutral700,
  borderActive: Green500,
  formPlaceholder: Neutral400,
  scrim: Black60,
  shimmer: Neutral900,
  shine: White,
};

// ---------------------------------------------------------------------------
// Theme object — semantic groups + legacy flat aliases so every existing
// consumer resolves to the app palette.
// ---------------------------------------------------------------------------

export interface FarmerChatTheme {
  isDark: boolean;
  content: ContentColors;
  brand: BrandColors;

  // legacy flat aliases
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceReading: string;
  surfaceFullScreen: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnBrand: string;
  textOnBrandSecondary: string;
  border: string;
  divider: string;
  cardBackground: string;
  chipBackground: string;
  chipBorder: string;
  bubbleUser: string;
  bubbleUserText: string;
  bubbleAi: string;
  bubbleAiText: string;
  inputBackground: string;
  buttonPrimary: string;
  buttonPrimaryText: string;
  buttonSecondaryBorder: string;
  buttonSecondaryText: string;
  brandPrimary: string;
  brandDark: string;
  brandDeep: string;
  brandLight: string;
  accentYellow: string;
  error: string;
  success: string;
  skeleton: string;
  overlay: string;
}

function buildTheme(
  isDark: boolean,
  content: ContentColors,
  brand: BrandColors,
): FarmerChatTheme {
  return {
    isDark,
    content,
    brand,
    background: content.surfacePrimary,
    surface: content.surfaceSecondary,
    surfaceElevated: content.surfaceSecondary,
    surfaceReading: content.surfaceReadingPrimary,
    surfaceFullScreen: brand.surfacePrimary,
    textPrimary: content.foregroundPrimary,
    textSecondary: content.foregroundSecondary,
    textTertiary: content.formPlaceholder,
    textOnBrand: brand.foregroundPrimary,
    textOnBrandSecondary: 'rgba(255,255,255,0.85)',
    border: content.borderDefault,
    divider: content.surfaceTertiary,
    cardBackground: content.surfaceSecondary,
    chipBackground: content.surfacePrimary,
    chipBorder: content.borderDefault,
    bubbleUser: content.surfaceReadingSecondary,
    bubbleUserText: content.foregroundPrimary,
    bubbleAi: content.surfaceReadingPrimary,
    bubbleAiText: content.foregroundPrimary,
    inputBackground: content.surfaceSecondary,
    buttonPrimary: content.buttonPrimarySurface,
    buttonPrimaryText: content.buttonPrimaryForeground,
    buttonSecondaryBorder: content.borderDefault,
    buttonSecondaryText: content.foregroundPrimary,
    brandPrimary: brand.surfacePrimary,
    brandDark: brand.surfaceSecondary,
    brandDeep: brand.surfaceTertiary,
    brandLight: content.surfaceActive,
    accentYellow: Sun300,
    error: brand.feedbackFail,
    success: brand.feedbackSuccess,
    skeleton: content.shimmer,
    overlay: content.scrim,
  };
}

/**
 * Active theme tokens. These are `let` bindings (not `const`) so the host
 * theme resolver (`resolveTheme`) can swap them at init — every screen that
 * imports `dayTheme` / `nightTheme` / `radius` / `typography` (directly or via
 * `useTheme()`) picks up the host palette through the ES-module live binding,
 * with zero per-screen edits.
 */
export let dayTheme: FarmerChatTheme = buildTheme(
  false,
  LightContentColors,
  BrandSemanticColors,
);
export let nightTheme: FarmerChatTheme = buildTheme(
  true,
  DarkContentColors,
  BrandSemanticColors,
);

/** Host logo override (docs/07 Part B). Null → built-in 6-petal mark. */
export let brandLogo: FarmerChatLogoSource | null = null;

// ---------------------------------------------------------------------------
// Radius tokens (Containers.kt / SmoothShapes)
// ---------------------------------------------------------------------------

export interface RadiusTokens {
  rounded: number;
  xxl: number;
  xl: number;
  lg: number;
  md: number;
  sm: number;
  /** legacy alias */
  pill: number;
}

const DEFAULT_RADIUS: RadiusTokens = {
  rounded: 999,
  xxl: 24,
  xl: 20,
  lg: 16,
  md: 12,
  sm: 8,
  pill: 999,
};

export let radius: RadiusTokens = { ...DEFAULT_RADIUS };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// ---------------------------------------------------------------------------
// Typography (Type.kt — system sans; size/lineHeight/weight per style)
// ---------------------------------------------------------------------------

function style(
  fontSize: number,
  lineHeight: number,
  fontWeight: TextStyle['fontWeight'],
): TextStyle {
  return { fontSize, lineHeight, fontWeight };
}

const DEFAULT_TYPOGRAPHY = {
  displayLarge: style(35, 42, '700'),
  displayMedium: style(28, 36, '700'),
  displaySmall: style(24, 32, '700'),
  titleLarge: style(22, 28, '700'),
  titleMedium: style(18, 24, '700'),
  titleSmall: style(16, 22, '700'),
  bodyLarge: style(19, 27, '400'),
  bodyMedium: style(17, 25, '400'),
  bodySmall: style(15, 22, '400'),
  labelLarge: style(17, 22, '600'),
  labelMedium: style(15, 20, '600'),
  labelSmall: style(13, 18, '600'),
  caption: style(13, 18, '400'),

  // legacy aliases used by earlier screens
  title: style(24, 32, '700'),
  heading: style(22, 28, '700'),
  subheading: style(18, 24, '700'),
  body: style(17, 25, '400'),
  button: style(17, 22, '600'),
};

export type TypographyTokens = typeof DEFAULT_TYPOGRAPHY;

export let typography: TypographyTokens = { ...DEFAULT_TYPOGRAPHY };

// ---------------------------------------------------------------------------
// Host theme resolver (docs/07 Part B) — one function overlays the host
// overrides onto the default tokens above and reassigns the live bindings.
// ---------------------------------------------------------------------------

/** #RRGGBB (or shorthand) → rgba() at the given alpha; passes through rgba()/named. */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  const m6 = /^#([0-9a-fA-F]{6})$/.exec(hex);
  const m3 = /^#([0-9a-fA-F]{3})$/.exec(hex);
  let r: number, g: number, b: number;
  if (m6) {
    r = parseInt(m6[1].slice(0, 2), 16);
    g = parseInt(m6[1].slice(2, 4), 16);
    b = parseInt(m6[1].slice(4, 6), 16);
  } else if (m3) {
    r = parseInt(m3[1][0] + m3[1][0], 16);
    g = parseInt(m3[1][1] + m3[1][1], 16);
    b = parseInt(m3[1][2] + m3[1][2], 16);
  } else {
    return color; // rgba()/named — leave as-is
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Overlay host color slots onto a base brand+content pair. */
function overlayColors(
  baseBrand: BrandColors,
  baseContent: ContentColors,
  hc?: FarmerChatThemeColors,
): { brand: BrandColors; content: ContentColors } {
  const brand: BrandColors = { ...baseBrand };
  const content: ContentColors = { ...baseContent };
  if (!hc) return { brand, content };
  if (hc.brandPrimary) brand.surfacePrimary = hc.brandPrimary;
  if (hc.brandPrimaryDark) {
    brand.surfaceSecondary = hc.brandPrimaryDark;
    content.buttonPrimarySurface = hc.brandPrimaryDark;
  }
  if (hc.brandAccent) {
    brand.foregroundSecondary = hc.brandAccent;
    brand.feedbackSuccess = hc.brandAccent;
    content.buttonPrimaryAccent = hc.brandAccent;
    content.borderActive = hc.brandAccent;
    content.surfaceActive = withAlpha(hc.brandAccent, 0.16);
  }
  if (hc.onBrand) {
    brand.foregroundPrimary = hc.onBrand;
    content.buttonPrimaryForeground = hc.onBrand;
  }
  if (hc.background) content.surfacePrimary = hc.background;
  if (hc.readingSurface) {
    content.surfaceReadingPrimary = hc.readingSurface;
    content.surfaceReadingTertiary = hc.readingSurface;
  }
  if (hc.cardSurface) content.surfaceSecondary = hc.cardSurface;
  if (hc.error) brand.feedbackFail = hc.error;
  if (hc.onBackground) content.foregroundPrimary = hc.onBackground;
  if (hc.onSurface) content.foregroundPrimary = hc.onSurface;
  return { brand, content };
}

/** Derive a dark color set when the host supplies only a light one. */
function deriveDarkColors(
  hc?: FarmerChatThemeColors & { dark?: FarmerChatThemeColors },
): FarmerChatThemeColors | undefined {
  if (!hc) return undefined;
  if (hc.dark) return hc.dark;
  // Keep the built-in dark neutrals; carry over just the brand colors so the
  // host palette still reads on dark surfaces (docs/07 "sensible dark derivations").
  return {
    brandPrimary: hc.brandPrimary,
    brandPrimaryDark: hc.brandPrimaryDark,
    brandAccent: hc.brandAccent,
    onBrand: hc.onBrand,
    error: hc.error,
  };
}

/**
 * Apply a host theme (docs/07 Part B). Idempotent; call once at init before
 * the first render. Passing `undefined` restores the built-in green brand.
 */
export function resolveTheme(theme?: FarmerChatThemeConfig | null): void {
  const light = overlayColors(BrandSemanticColors, LightContentColors, theme?.colors);
  const dark = overlayColors(
    BrandSemanticColors,
    DarkContentColors,
    deriveDarkColors(theme?.colors),
  );
  dayTheme = buildTheme(false, light.content, light.brand);
  nightTheme = buildTheme(true, dark.content, dark.brand);

  const shape = theme?.shape;
  radius = {
    ...DEFAULT_RADIUS,
    xxl: shape?.cardCornerRadius ?? DEFAULT_RADIUS.xxl,
    md:
      shape?.buttonCornerRadius ??
      shape?.inputCornerRadius ??
      DEFAULT_RADIUS.md,
  };

  const scale = theme?.typography?.typeScale ?? 1;
  const family = theme?.typography?.fontFamily;
  if (scale !== 1 || family) {
    const scaled: Partial<TypographyTokens> = {};
    for (const key of Object.keys(DEFAULT_TYPOGRAPHY) as (keyof TypographyTokens)[]) {
      const base = DEFAULT_TYPOGRAPHY[key];
      scaled[key] = {
        ...base,
        fontSize: base.fontSize != null ? Math.round(base.fontSize * scale) : base.fontSize,
        lineHeight:
          base.lineHeight != null ? Math.round(base.lineHeight * scale) : base.lineHeight,
        ...(family ? { fontFamily: family } : null),
      };
    }
    typography = scaled as TypographyTokens;
  } else {
    typography = { ...DEFAULT_TYPOGRAPHY };
  }

  brandLogo = theme?.logo ?? null;
}
