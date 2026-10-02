// Email-safe mirror of a subset of the design system's tokens (src/styles.css, light mode only —
// email clients don't reliably honor `prefers-color-scheme`, and the shell pins `color-scheme:
// light`). Literal hex/px values, since mail clients don't support CSS variables, oklch colors or
// Tailwind. Pure data: no server-only marker, so scripts/build-auth-email-templates.ts (a plain
// bun/node script, not a Worker) can import it too.
//
// tests/unit/email/design-tokens.test.ts fails if any of these drift from styles.css (it parses the
// `--m3-*` oklch values and `--radius-*` px values there and converts/compares).

/** M3 color roles used by email HTML, light mode. Each comment names the `--m3-*` var it mirrors. */
export const emailColors = {
  primary: "#37453A", // --m3-primary
  onPrimary: "#FFFFFF", // --m3-on-primary
  primaryContainer: "#DCE3D8", // --m3-primary-container
  onPrimaryContainer: "#253028", // --m3-on-primary-container
  background: "#F4F5F2", // --m3-surface (the page background behind the card)
  surface: "#FFFFFF", // --m3-surface-container-lowest (the card itself)
  onSurface: "#1F2420", // --m3-on-surface
  onSurfaceVariant: "#646B63", // --m3-on-surface-variant (muted text)
  outlineVariant: "#E3E6E0", // --m3-outline-variant (hairline borders)
} as const;

/** Corner radii, in px. Comments name the `--radius-*` var each mirrors. */
export const emailRadii = {
  button: 12, // --radius-md (buttons, inputs — see styles.css)
  card: 20, // --radius-xl (cards — shadcn Card uses rounded-xl)
} as const;

/** A small spacing scale, in px, used for padding/margins throughout the email components. */
export const emailSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
} as const;

/** Type scale for email copy, px + weight. Narrower than the app's (email clients, not Tailwind). */
export const emailType = {
  brand: { size: 18, weight: 700 }, // the "RenoVision" wordmark in the header
  heading: { size: 17, weight: 700 },
  body: { size: 15, weight: 400 },
  small: { size: 13, weight: 400 },
} as const;

/** `--font-sans` in styles.css is "Inter", ui-sans-serif, system-ui, sans-serif; email clients
 * mostly can't load webfonts, so this keeps Inter first (for the rare client that has it available
 * as a system font) and falls back to the same sans-serif stack browsers use anyway. */
export const emailFontFamily = "Inter, Arial, Helvetica, sans-serif";
