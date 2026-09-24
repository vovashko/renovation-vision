# Handoff: RenoTrack → Material 3 design system

## Overview
Re-theme the RenoTrack app (`vovashko/renovation-vision`, TanStack Start + Tailwind v4 + shadcn/ui) to Material 3. Colors come from the attached Material Theme Builder export (seed `#E4E9EB`, neutral slate), the font is Inter, and there are custom status colors. This covers tokens, shared UI primitives, and the RenoTrack-specific components (project header, stage timeline, floor plan, room panel, chat).

## About the design files
`reference/RenoTrack Design System (Material 3) v2.dc.html` is a **design reference built in HTML**. It is not production code. Open it in a browser (keep `support.js` next to it) to see the target look and hover states. Recreate it inside the existing codebase using its patterns: Tailwind utility classes, `cva` variants in `src/components/ui/*`, and Radix primitives. Do not copy inline styles.

## Fidelity
**High-fidelity.** Colors, type, radii, elevation, spacing and states are final. Match them exactly.

---

## Step 1: Tokens (drop-in)
Replace `src/styles.css` with `src/styles.css` from this bundle. It:
- Defines raw M3 roles as `--m3-*` (light + `.dark`, oklch with hex in comments), generated from `material-theme.json`.
- Re-points every shadcn variable (`--primary`, `--card`, `--muted`, `--border`, `--sidebar-*`, `--status-*`…) at M3 roles, so existing components re-theme with no code changes.
- Registers M3 names as Tailwind colors: `bg-surface-container-low`, `text-on-surface-variant`, `bg-secondary-container`, `bg-success-container`, `text-on-warning-container`, `border-outline-variant`, etc.
- Adds status container pairs: `bg-status-{done|progress|pending|blocked}-container` + `text-on-status-…-container`.
- Adds type utilities `text-display-lg` … `text-label-sm`, the `state-layer` utility, elevation `shadow-el1…el5`, and the M3 radius scale.
- Neutralises `--gradient-primary`, `--gradient-surface`, `--shadow-soft` and `--shadow-elegant` (M3 has no gradients). Remove their usages when touching each file.

**Fonts.** Add to the root route `head()` (`src/routes/__root.tsx`):
```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap
https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=block
```
Add a `preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com` as well.

## Step 2: Icons
Switch from `lucide-react` to Material Symbols Outlined. Create `src/components/ui/icon.tsx`:
```tsx
export function Icon({ name, size = 24, fill = false, className }: { name: string; size?: 18|20|24; fill?: boolean; className?: string }) {
  return <span aria-hidden className={cn("material-symbols-outlined", className)}
    style={{ fontSize: size, fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}` }}>{name}</span>;
}
```
Mapping: `LayoutDashboard→dashboard`, `ListChecks→checklist`, `Map→map`, `MessageCircle→chat`, `Hammer→construction`, `Calendar→calendar_month`, `TrendingUp→trending_up`, `DollarSign→payments`, `User→person`, `Plus→add`, `Check→check`, `CheckCircle→check_circle`, `Clock→schedule`, `Ban/AlertCircle→block`. The active nav item uses `fill`. Sizes: 24 for nav, list items and FAB; 20 for card labels; 18 for chip and button leading icons.

## Step 3: Primitives (`src/components/ui/*`)

### Button (`button.tsx`)
All buttons: `h-10 rounded-full px-6 text-label-lg state-layer inline-flex items-center gap-2 transition-shadow`. With a leading icon: `pl-4 pr-6`. Icon size 18.
| variant | classes |
|---|---|
| `default` (Filled) | `bg-primary text-on-primary hover:shadow-el1 active:shadow-none` |
| `tonal` (new) | `bg-secondary-container text-on-secondary-container hover:shadow-el1` |
| `outline` | `border border-outline text-primary bg-transparent` |
| `ghost` / `link` → Text | `px-3 text-primary bg-transparent` |
| `elevated` (new) | `bg-surface-container-low text-primary shadow-el1 hover:shadow-el2` |
| `destructive` | `bg-error text-on-error` |
FAB (new `fab` variant or component): `size-14 rounded-lg bg-primary-container text-on-primary-container shadow-el3 hover:shadow-el4`, with a 24px icon.
Focus: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`. Disabled: container at 12% of on-surface, content at 38%.

### Chip / Badge (`badge.tsx`)
`h-8 rounded-sm px-4 text-label-lg inline-flex items-center gap-2`. With a leading icon: `pl-2`, icon size 18.
- assist: `border border-outline-variant text-on-surface state-layer`
- filter selected: `bg-secondary-container text-on-secondary-container`, leading `check` icon
- status variants use `bg-status-X-container text-on-status-X-container`, with icons: done=`check_circle`, progress=`construction`, pending=`schedule`, blocked=`block`

### Progress (`progress.tsx`): M3 linear
Height 4px (`h-1`). Layout is a flex row with `gap-1` (4px): the indicator is `rounded-full bg-{color}` at `width:{v}%`, and the track `flex-1 rounded-full bg-{container}` has a 4px stop dot (`size-1 rounded-full bg-{color}`) absolutely positioned at its right end. At 100% there is no track and no gap. Colors: default `primary` on `secondary-container`. For a status bar, use `status-X` on `status-X-container`; pending uses `outline` on `surface-container-highest`.

### Card (`card.tsx`)
Radius `rounded-md` (12px), padding 16px (`p-4`), 24px for large headers. Variants:
- `elevated`: `bg-surface-container-low shadow-el1`
- `filled`: `bg-surface-container-highest` (stat cards)
- `outlined` (default for stage/room cards): `bg-surface border border-outline-variant`
Clickable cards add `state-layer cursor-pointer`.

### Navigation drawer (`app-sidebar.tsx` / `sidebar.tsx`)
Standard drawer: width 360px (`--sidebar-width: 22.5rem`), `bg-surface-container-low`, **no shadow and no border**, `p-3`, `rounded-r-lg` if floating. Header: `construction` icon (24, `text-primary`) + "RenoTrack" in `text-title-sm text-on-surface-variant`, padded `px-4 pt-4 pb-5`. Item: `h-14 rounded-full pl-4 pr-6 gap-3 text-label-lg text-on-surface-variant state-layer`, 24px icon. Active: `bg-secondary-container text-on-secondary-container` with a filled icon. Badge count sits right-aligned in `text-label-lg`.

## Step 4: RenoTrack components
The reference file has a section for each.

**Project header** (`routes/index.tsx`): elevated card, `px-8 py-6`, flex row that wraps, `justify-between`, gap 48px.
- Left side, top to bottom: "Active project" in `text-label-md text-on-surface-variant` (sentence case, not uppercase); name in `text-display-sm`; address in `text-body-lg text-on-surface-variant`; then the manager row (`person` icon 20, "Manager:" in on-surface-variant, name `font-medium text-on-surface`).
- Right side, 380px column: a row with "Overall progress" `text-label-md` and `41%` in `text-headline-md`, then the primary linear progress (mt-3), then "Currently working on **Stage**" in `text-body-md`.

**Stat card**: filled card containing icon 20 + label (`text-label-md text-on-surface-variant`), then the value in `text-headline-sm` (mt-3), then the sub-line in `text-body-md text-on-surface-variant`. Dates use the format "Mar 02, 2026".

**Room card**: outlined, clickable. A row with the room name (`text-title-md`) and a status chip, then the status progress bar (mt-4), then the percentage right-aligned in `text-body-sm text-on-surface-variant`.

**Stage list item** (compact list): an M3 two-line list item, `min-h-18 (72px) pl-4 pr-6 gap-4`, with rows separated by a 1px `outline-variant` divider inset 72px. Leading element is a 40px circle: `status-X-container` background with a `check` icon when done, otherwise the stage number in `text-label-lg`. Headline is `text-body-lg`, supporting text (dates) is `text-body-md text-on-surface-variant`. Trailing: a 240px status progress bar plus the % in `text-label-md`.

**Stage card, expanded** (`routes/stages.tsx`): timeline with a 56px left gutter, a 2px `outline-variant` vertical line at x=19, and a 40px number marker on `status-X-container`. The card is outlined, `px-6 pt-4 pb-5`.
- Header row: title `text-title-lg`, dates `text-body-md text-on-surface-variant`, status chip on the right.
- Progress block (mt-5): a row with "Progress" and % in `text-body-sm text-on-surface-variant`, then the status bar.
- Checklist: 48px rows, gap 16px. Icon is `check_box` 24 in `text-success` when done, otherwise `check_box_outline_blank` in `text-on-surface-variant`. Text is `text-body-lg`; done items get `line-through text-on-surface-variant`.

**Floor plan** (`components/floor-plan.tsx`): outer panel `rounded-md bg-surface-container-low p-4`; plan frame `rounded-md bg-surface-container-high p-2`; rooms separated by 4px gaps.
- Each room tile: `rounded-sm` (8px), `bg-status-X-container text-on-status-X-container state-layer`, centred name in `text-title-sm` and % in `text-body-sm`.
- The selected room gets `outline outline-3 -outline-offset-3 outline-status-X`.
- Legend below (mt-4): 12px `rounded-xs` swatches in `status-X`, labels in `text-body-md text-on-surface-variant`, gap 8px/20px.

**Selected room panel**: `rounded-md bg-surface-container-low p-5`. Contents, top to bottom: "Selected room" in `text-label-md`; the room name in `text-title-lg`; a status chip (mt-3); a Progress row (mt-5, % in `font-medium text-on-surface`); the status bar; a hint line in `text-body-md text-on-surface-variant` (mt-5).

**Chat** (`routes/chat.tsx`): the panel is `rounded-lg bg-surface-container p-4`, with bubbles spaced 8px apart.
- Received bubbles: `bg-surface-container-highest text-on-surface`, `rounded-[20px_20px_20px_4px]`.
- Sent bubbles: `bg-primary text-on-primary`, `rounded-[20px_20px_4px_20px]`.
- All bubbles use `px-4 py-2.5 text-body-md` with a max width of 75%, and a timestamp in `text-label-sm` (sent: `inverse-on-surface`; received: `on-surface-variant`).

## Interactions & behavior
- **State layers** (M3): hover 8%, focus 10%, pressed 10% of the content color, via the `state-layer` utility. Transition 150ms, `cubic-bezier(0.2,0,0,1)`.
- **Elevation changes:** filled and tonal buttons go to el1 on hover, elevated buttons el1→el2, FAB el3→el4.
- **Floor plan:** clicking a room selects it (outline) and updates the Selected room panel. Use the existing state in `floor-plan.tsx`.
- **Uppercase:** remove all `uppercase tracking-wider` eyebrow styles and use `text-label-md` in sentence case.

## Design tokens (light)
primary `#5A5F61` / on `#FFFFFF`; primary-container `#E4E9EB` / on `#63696B`; secondary `#5D5F5F`; secondary-container `#E2E2E3` / on `#636465`; tertiary `#625D63`; error `#BA1A1A` / container `#FFDAD6` / on `#93000A`; surface `#FCF9F8`; on-surface `#1C1B1C`; on-surface-variant `#434749`; surface containers lowest→highest `#FFFFFF #F6F3F2 #F0EDED #EBE7E7 #E5E2E1`; outline `#747879`; outline-variant `#C4C7C8`; inverse-surface `#313030`.
Status (custom): success `#3B6939` / container `#BCF0B4` / on `#23501F`; warning `#7C5800` / container `#FFDEA6` / on `#5E4200`; pending = outline + surface-container-highest; blocked = error roles. Dark values are in `styles.css`.
Type (Inter; size/line/weight/tracking px): display 57/64/400/-0.25, 45/52/400/0, 36/44/400/0 · headline 32/40, 28/36, 24/32 (400) · title-lg 22/28/400/0, title-md 16/24/500/0.15, title-sm 14/20/500/0.1 · body 16/24/0.5, 14/20/0.25, 12/16/0.4 (400) · label 14/20/0.1, 12/16/0.5, 11/16/0.5 (500).
Shape: 0, 4, 8, 12, 16, 28, full. Spacing: 4px grid (4, 8, 12, 16, 20, 24, 32, 48, 56).
Elevation: see `--m3-el1…el5`.

## Assets
- Fonts: Inter and Material Symbols Outlined (Google Fonts).
- `material-theme.json`: the source Theme Builder export. To regenerate the colors, re-export it and re-run the conversion to oklch.

## Files
- `src/styles.css`: drop-in replacement for the repo's `src/styles.css`
- `material-theme.json`: Theme Builder export (light, dark, and medium/high contrast)
- `reference/RenoTrack Design System (Material 3) v2.dc.html` (+ `support.js`): visual reference
