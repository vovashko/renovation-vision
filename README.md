# Handoff: RenoVision design system v5 ("Sage")

## Overview
Re-theme the RenoVision app (`vovashko/renovation-vision`: TanStack Start, Tailwind v4, shadcn/ui) to the v5 design system. It keeps Material 3 structure (color roles, type scale, state layers) with a flat sage and forest-green look: white cards with hairline borders on a soft sage-gray page, tinted panels to group controls, and forest green reserved for the primary action and active states. The font is Inter; icons are Material Symbols Outlined at weight 300.

## About the design files
`reference/RenoVision Design System v5.dc.html` is a **design reference built in HTML**. Open it in a browser, with `support.js` and `assets/` next to it. Recreate it with the codebase's own patterns: Tailwind utilities, `cva` variants in `src/components/ui/*`, and Radix primitives. Don't copy the inline styles.

## Fidelity
**High-fidelity.** Colors, type, radii, spacing and states are final.

---

## Step 1: Tokens (drop-in)
Replace `src/styles.css` with `src/styles.css` from this bundle. It contains:
- The `--m3-*` roles, light and `.dark`, in oklch.
- The shadcn variables (`--primary`, `--card`, `--border`, `--sidebar-*`, `--status-*`…) aliased to those roles, so existing components re-theme with no code changes.
- Tailwind color names:
  - shadcn: `bg-primary`, `bg-card`, `text-muted-foreground`, …
  - M3: `bg-surface-container-high`, `text-on-surface-variant`, `bg-primary-container`, `bg-tertiary-container`
  - Status: `bg-success`, `bg-success-container`, `text-on-success-container`, `bg-progress`, `bg-progress-container`, `text-on-progress-container`, `bg-attention`, `text-attention-text`, `bg-attention-container`, `text-on-attention-container`, `border-attention-outline`
  - shadcn-style status aliases: `bg-status-{done|progress|pending|blocked}`, `bg-status-…-container`, `text-on-status-…-container`
- Type utilities: `text-display`, `text-headline-lg`, `text-headline-md`, `text-title-lg`, `text-title-md`, `text-body-lg`, `text-body-md`, `text-body-sm`, `text-label-lg`, `text-label-md`, `text-label-sm`.
- The `state-layer` utility (8% on hover, 12% on focus and press), `shadow-float`, and the radius scale.
- Neutralised legacy tokens: `--gradient-*` are now solid, and `--shadow-soft` and `--shadow-elegant` are `none`. Remove their usages as you touch each file.

**Fonts.** Add to the root route `head()` in `src/routes/__root.tsx`, with a preconnect to `fonts.googleapis.com` and `fonts.gstatic.com`:
```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap
https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,300..400,0..1,0&display=block
```

## Step 2: Logo
Copy `assets/renovision-logo.svg` (the full lockup) and `assets/renovision-mark.svg` (the sign only) into `src/assets/`.
- Use the mark at the top of the nav rail (40px), and as the favicon (`<link rel="icon" type="image/svg+xml">`).
- Use the lockup wherever there's room: auth screens and headers wider than 120px.
- Colors: wordmark `#1F2420`, sign tile `#E6EAE3`, house `#5E665D`. Use it on light surfaces only.

## Step 3: Icons
Replace `lucide-react` with Material Symbols Outlined. Create `src/components/ui/icon.tsx`:
```tsx
export function Icon({ name, size = 24, fill = false, className }: { name: string; size?: 16|18|20|22|24; fill?: boolean; className?: string }) {
  return <span aria-hidden className={cn("material-symbols-outlined", className)}
    style={{ fontSize: size, fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 300, 'GRAD' 0, 'opsz' ${size}` }}>{name}</span>;
}
```
Mapping:
- `LayoutDashboard`→`grid_view`, `ListChecks`→`checklist`, `Map`→`floor`, `MessageCircle`→`chat_bubble`, `Settings`→`settings`
- `Bell`→`notifications`, `Search`→`search`, `Plus`→`add`, `Minus`→`remove`, `Check`→`check`, `ChevronRight`→`chevron_right`, `Info`→`info`
- `User`→`person`, `Calendar`→`calendar_month`, `Clock`→`schedule`, `Euro`/`DollarSign`→`euro`
- Rooms: `chair`, `countertops`, `bathtub`, `bed`

Sizes: 24 in the nav rail, 22 in buttons and tiles, 20 in inline icons.

## Step 4: Primitives (`src/components/ui/*`)

### Button (`button.tsx`)
Base classes: `h-11 rounded-md px-5 text-label-lg inline-flex items-center gap-2 transition-colors`. A leading icon is 20px.

| variant | classes |
|---|---|
| `default` | `bg-primary text-on-primary hover:bg-primary/92 active:bg-primary/88` |
| `tonal` (new) | `bg-secondary-container text-on-secondary-container state-layer` |
| `outline` | `bg-surface-container-lowest border border-outline-variant text-on-surface state-layer` |
| `ghost` / `link` | `px-3 text-primary bg-transparent state-layer` |
| `destructive` | `bg-error text-on-error` |
| size `lg` | `h-14 w-full text-title-md` (full-width primary action, e.g. "Add room") |
| size `icon` | `size-11 rounded-full` with a 22px icon; white `bg-surface-container-lowest` on panels, `bg-secondary-container` on white |

Notification badge on an icon button: `absolute top-1.5 right-1.5 min-w-4 h-4 rounded-full bg-success text-white text-[10px] font-semibold ring-2 ring-white`.

Focus ring on every variant: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`.

### Chip / Badge (`badge.tsx`)
Base classes: `h-8 rounded-full px-3.5 text-label-lg inline-flex items-center gap-2`, with a leading dot `size-2 rounded-full`.
- **Status chips.** Pattern: `bg-status-X-container text-on-status-X-container`, with a dot in `bg-status-X`. The compact 28px version (`h-7 px-3 text-label-md`) is used inside cards.
  - done: success
  - in progress: progress (blue)
  - pending: **not filled**. White fill with `border border-dashed border-outline`, and a hollow dot (`size-2 rounded-full border-2 border-status-pending bg-transparent`). "Not started yet" should read as empty, never as a pale green.
  - blocked: error
- **On tinted panels** (anything `bg-surface-container-high` or darker), status chips switch to `bg-surface-container-lowest`, i.e. white, so they stay visible against the panel.
- **Attention chip:** `bg-attention-container text-on-attention-container`, with a leading 18px icon in `text-attention` (`euro` for over budget, `schedule` for late). Examples: "Over budget · 4%", "3 days late".
- **Live / assist chip:** `bg-surface-container-lowest border border-outline-variant`, with a red dot for live.
- **Selected filter:** `bg-primary text-on-primary`, with a leading `check` icon.

### Progress (`progress.tsx`)
The track is `h-2 rounded-full` with overflow hidden; the indicator is `h-full rounded-full`.
- Default: indicator `bg-primary` on track `bg-surface-container-highest`. Inside a tinted panel, the track is `bg-surface-container-lowest`.
- Status bars: indicator `bg-status-X` on track `bg-status-X-container`. Done is a solid `bg-success` bar with no visible track. Pending has no indicator: an empty white track, `bg-surface-container-lowest border border-dashed border-outline`.

### Card (`card.tsx`)
- **Default:** `rounded-xl bg-card border border-outline-variant`, with **no shadow**. Padding is `px-5 py-4` for stat cards and `p-5` to `px-7 py-6` for larger ones.
- **`tinted` variant:** `rounded-xl bg-surface-container-high`, with no border. Used for the selected room panel, control groups and chat.
- **`deep` variant:** `rounded-xl bg-tertiary-container text-on-tertiary-container`. Used for chart panels.
- **Attention variant:** add `border-attention-outline`, plus an 8px `bg-attention` dot at the top right.
- **Clickable cards:** hover `bg-surface-container-low`.

### Navigation rail (`app-sidebar.tsx`, replaces the wide sidebar)
- **Rail:** `w-24 rounded-2xl bg-card border border-outline-variant py-5 flex flex-col items-center gap-2`.
- **Top:** the mark (40px), with `mb-4`.
- **Items:** `size-14 rounded-lg grid place-items-center text-on-surface`, with a 24px icon at weight 300. Each item gets a tooltip with its label and an `aria-label`.
- **Active item:** `bg-surface-container-high`. **Hover:** `bg-surface`.
- **Bottom:** Settings, pushed down with `mt-auto`.
- **Expand on hover:** the rail sits in a fixed 96px slot (`relative w-24`) and is itself `absolute inset-y-0 left-0 z-20 overflow-hidden`, so expanding overlays the page instead of pushing it.
  - Collapsed: `w-24`. Expanded on `mouseenter` or `focus-within`: `w-60` (240px) plus `shadow-float`. Transition `width 220ms cubic-bezier(0.2,0,0,1)`.
  - Items become full-width rows (`h-14 rounded-lg flex items-center whitespace-nowrap`): a fixed `w-14` icon cell, then the label in `text-label-lg`. The label goes from `opacity-0` to `opacity-100` (150ms) when expanded.
  - Top: the full logo lockup at `h-10` in an `overflow-hidden` box, so only the mark shows when collapsed and the wordmark appears as the rail widens.
  - Collapse on `mouseleave` / blur. Keep `aria-label` on every item, since labels are hidden while collapsed.

### Inputs
- **Search field:** `h-12 rounded-lg bg-surface-container-low border border-outline-variant px-4 gap-2.5 text-body-md`, with a 22px `search` icon in `text-on-surface`. The placeholder is `text-on-surface-variant`.
- **Switch:** track `w-13 h-7.5 rounded-full`; on `bg-primary`, off `bg-surface-container-highest`. The thumb is 24px: white when on, `bg-outline` when off.
- **Segmented control** (Week / Month / Year): the container is `p-0.5 rounded-full bg-on-surface/12`; each segment is `h-7.5 px-3.5 rounded-full text-[13px]`; the selected segment is `bg-surface-container font-medium`.
- **Stepper:** two `size-11 rounded-full bg-surface-container-lowest` buttons (`remove` and `add`) under a `text-display` value.

## Step 5: RenoVision components (`routes/*`, `components/*`)

**Project header** (`routes/index.tsx`). Default card, `px-7 py-6`, laid out as a wrapping flex with `justify-between` and `gap-x-12`.
- **Left side, top to bottom:**
  - "Active project" in `text-body-md text-on-surface-variant`
  - The name in `text-headline-lg`
  - The address in `text-body-lg text-on-surface-variant`
  - A manager row: a 28px `rounded-full bg-surface-container-high` avatar holding the `person` icon, then "Manager", then the name in `font-medium text-on-surface`
- **Right side, a 380px column, top to bottom:**
  - A row with "Overall progress" on the left and `41%` in `text-headline-md` on the right
  - The default progress bar
  - "Currently working on **Stage**"

**Stat card.** Default card, `px-5 py-4`.
- **Content, top to bottom:**
  - The label in `text-body-md`.
  - The value in `text-headline-md`, with its unit in `text-title-md` (grayed with `text-on-surface-variant` for "/ 7").
  - A change line in `text-body-sm text-on-surface-variant`, starting with the delta (`font-medium`).
- **Delta colors:** `text-success-text` when the change is good; `text-attention-text` when it's over budget or late. Use `text-error` only for a real failure.
- **Over budget:** the card uses the attention variant. Example: "88.1 k€", "↑ 4% over", "plan of 84.5 k€".

**Room card.** Default card, `px-5 py-4.5`, clickable.
- **Content, top to bottom:**
  - A header row: the name (`text-title-md`) on the left and a compact status chip on the right.
  - The status progress bar (`mt-4`).
  - The percentage, right-aligned, in `text-body-sm text-on-surface-variant`.
- **Late:** an extra line under the name: a 6px `bg-attention` dot and "3 days late" in `text-body-sm font-medium text-attention-text`.

**Room list** (the Rooms panel).
- **Panel:** `rounded-xl bg-surface-container-low border border-outline-variant p-5`. The header row is "Rooms" in `text-title-md` with an `info` icon on the right.
- **Rows:** 8px apart. Each row is `rounded-lg bg-card border border-outline-variant py-2 pl-2 pr-3.5 gap-3`, with hover `bg-surface-container-low`.
- **Inside each row:**
  - A 44px `rounded-md bg-surface-container-high` icon tile.
  - The name in `text-label-lg` and a supporting line in `text-body-sm text-on-surface-variant`.
  - On the right: a `chevron_right` icon, or a 20px `rounded-full bg-success` circle with a white `check` when the room is done.
- **Footer:** the `lg` "Add room" button.

**Stage list item.** Default card, `py-3.5 pl-3.5 pr-5 gap-3.5`.
- **Left:** a 44px `rounded-md` tile on `status-X-container`, showing a `check` icon or the stage number.
- **Middle:** the title in `text-title-md` and the dates in `text-body-sm text-on-surface-variant`.
- **Right:** a 140px status bar, then the % in `text-label-lg`.

**Stage card, expanded** (`routes/stages.tsx`).
- **Timeline:** a 60px left gutter with a 2px `bg-outline-variant` line at x=21. The marker is a 44px circle in `bg-status-X` with `text-white` and a `font-semibold` number.
- **Card:** default, `px-6 py-5`.
- **Header row:** the title (`text-title-lg`) and dates (`text-body-md text-on-surface-variant`) on the left, a compact status chip on the right.
- **Progress block** (`mt-4.5`): a "Progress" row with the % in `font-medium text-on-surface`, then the status bar.
- **Checklist:** 40px rows with 12px gaps.
  - Done: a 22px `rounded-[7px] bg-primary text-on-primary` box with a `check` icon (16px), and the text in `line-through text-on-surface-variant`.
  - Open: a 22px `rounded-[7px] border-[1.5px] border-outline` box.

**Floor plan** (`components/floor-plan.tsx`).
- **Outer:** a default card, `p-4`. **Inner frame:** `rounded-lg bg-surface-container p-2 gap-1.5`.
- **Room tiles:** `rounded-md bg-status-X-container text-on-status-X-container`, with the name in `text-label-lg` and the % in `text-body-sm`. Pending tiles are white with `border border-dashed border-outline`.
- **Selected room:** a darker outline in the room's own status color: `outline-2 -outline-offset-2 outline-status-X` (e.g. `outline-progress` on an in-progress room). A pending room's selected outline is solid `outline-outline`, replacing the dashed border.
- **Legend** (`mt-3.5`): 8px round dots in `bg-status-X`, labels in `text-[13px] text-on-surface-variant`.

**Selected room panel.** A tinted card, `p-5`. Content, top to bottom:
- "Selected room" in `text-body-md text-on-surface-variant`.
- The name in `text-title-lg`.
- A compact status chip with a **white fill** (`mt-3`).
- A progress row (`mt-5`).
- The bar: `bg-primary` on a `bg-surface-container-lowest` track.
- A hint in `text-body-md text-on-surface-variant` (`mt-5`).

**Bar chart** (budget or progress over time). A deep card, `p-5`.
- **Header:** the title in `text-title-md` and a segmented control on the right.
- **Bars:** `flex-1 rounded-full bg-surface-container`, 10px apart.
- **Highlighted bar:** `bg-primary`, with a value bubble above it (`h-5.5 px-2 rounded-full bg-secondary text-on-secondary text-[11px]`).

**Chat** (`routes/chat.tsx`). A tinted card, `p-4`, with bubbles 8px apart.
- **Received:** `bg-card rounded-[18px_18px_18px_6px]`.
- **Sent:** `bg-primary text-on-primary rounded-[18px_18px_6px_18px]`.
- **All bubbles:** `px-3.5 py-2.5 text-body-md`, max width 75%.
- **Timestamp:** `text-[11px]`; `text-on-surface-variant` on received, `text-primary-container` on sent.

## Status model
- **Progress state**, exactly one per stage or room:
  - `done` (green)
  - `progress` (calm blue)
  - `pending` (hollow: white with dashed outline)
  - `blocked` (red)
- **State follows progress**: `pending` is always 0%. When progress becomes greater than 0, the state switches to `progress`; at 100% it becomes `done`. `blocked` keeps whatever progress was reached when the work stopped.
- **Attention flag**, orange, optional. It's computed, not stored as a state: over budget when `spent > budget`, late when `today > endDate && state !== 'done'`. It is shown *in addition to* the state, using the attention chip, the late line, or the attention card variant. Orange is never used for anything else.

## Interactions & behavior
- **Hover and press:** state layer (8% / 12%) with a 150ms `cubic-bezier(0.2,0,0,1)` transition. Cards and list rows use `hover:bg-surface-container-low`.
- **Floor plan:** clicking a room selects it (outline) and updates the Selected room panel. Keep the existing state.
- **No shadows** on cards; use `shadow-float` only for popovers, dropdowns and toasts.
- **No all-caps** eyebrow labels anywhere; use sentence case.
- **Accessibility:** body text uses `on-surface` or `on-surface-variant` only. Colored text uses the `*-text` / `on-*-container` tokens, never the dot or bar colors. Chips on tinted panels use a white fill.

## Design tokens (light, hex)
**Core roles**
- primary `#37453A` / on `#FFFFFF`; primary-container `#DCE3D8` / on `#253028`
- secondary `#5E665D`; secondary-container `#E6EAE3` / on `#2E352E`
- tertiary `#6F786D`; tertiary-container `#A9B0A6` / on `#1F2420`
- error `#D93A30`; error-container `#FBDCD8` / on `#7A1510`

**Surfaces and lines**
- surface (page) `#F4F5F2`; on-surface `#1F2420`; on-surface-variant `#646B63`
- containers, lowest→highest: `#FFFFFF`, `#F9FAF8`, `#EEF0EB`, `#E6EAE3`, `#DDE2DA`
- outline `#A3AAA1`; outline-variant `#E3E6E0`; inverse-surface `#2C332D`

**Status**
- success `#4C8B56` (bar/dot) / text `#3F7A48` / container `#D3E9D2` / on `#1D4424`
- progress `#3F7391` / container `#DDE8EE` / on `#1E3A4C`
- pending: hollow ring `#8A918A`, white container with a dashed `#A3AAA1` border, on `#2E352E`
- attention `#E08A1E` (dot/icon) / text `#9A6A00` / container `#FBE7CC` / on `#5A3500` / outline `#F0C98E`

Dark values are in `styles.css`.

**Type (Inter).** Format: size/line-height in px, then weight and tracking.

| style | size/line | weight | tracking |
|---|---|---|---|
| display | 45/52 | 500 | -0.5 |
| headline-lg | 32/40 | 500 | -0.25 |
| headline-md | 28/36 | 500 | -0.25 |
| title-lg | 22/28 | 500 | 0 |
| title-md | 16/24 | 500 | 0 |
| body-lg | 16/24 | 400 | 0 |
| body-md | 14/20 | 400 | 0 |
| body-sm | 12/16 | 400 | 0 |
| label-lg | 14/20 | 500 | 0 |
| label-md | 13/16 | 500 | 0 |
| label-sm | 11/16 | 500 | 0 |

**Radius:** 8 (tooltip), 12 (button, input, tile), 16 (list item, nav item, search), 20 (card), 28 (shell, rail), and full (chip, switch, bars).
**Spacing:** 4px grid.

## Files
- `src/styles.css`: drop-in replacement for the repo's `src/styles.css`.
- `assets/renovision-logo.svg`, `assets/renovision-mark.svg`: the logo lockup and the mark.
- `reference/RenoVision Design System v5.dc.html` (+ `support.js`, `assets/`): the visual reference.
