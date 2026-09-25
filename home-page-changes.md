# Home page (Overview) changes: client app → apply to the manager app

This describes what changed on the client app's home page (`src/routes/index.tsx`) and in the app shell around it during the v5 "Sage" redesign. Apply the same changes to the manager side so the two apps match.

Ground rules (same as the client app):
- Tailwind utilities and `styles.css` tokens only. No hex values, no inline styles. The only exception is CSS custom properties that carry data, such as `--progress`.
- No card shadows, no gradients, no uppercase labels. Use sentence case everywhere.
- Keep props, data flow and routing unchanged. This is a visual change plus the status logic below.
- Check light and dark mode after each change.

---

## 1. App shell (affects the home page)

### Navigation rail (desktop, `md` and up)
- A 96px rail (`w-24`) in a sticky slot: `sticky top-4 m-4 mr-0 h-[calc(100dvh-2rem)]`.
- On hover or keyboard focus it expands to 240px (`hover:w-60 focus-within:w-60`) and overlays the page instead of pushing it. The rail is `absolute` inside the fixed 96px slot. Use `shadow-float` only while expanded. Transition: `duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)]`.
- Style: `rounded-2xl border border-outline-variant bg-card`.
- **Logo:** collapsed, show only the **logo mark** (`renovision-mark.svg`, 40px). When expanded, cross-fade to the full lockup (`renovision-logo.svg`, 150×40). Render the mark and the lockup as two separate images inside a fixed-width link (`w-[150px]`). Don't clip one wide image: host pages with `img { max-width: 100% }` shrink it into the rail. Dark mode keeps the mark only, because the lockup's wordmark is dark.
- Nav items are 56px tall (`h-14 rounded-lg`) with a 56px icon column. Active item: `bg-surface-container-high`; others `hover:bg-surface`. Labels fade in with the expansion.
- Phones use the bottom tab bar instead of the rail.

### Top bar
- **The home page has no top bar.** Its project card already shows the same information. Content starts level with the rail's top edge: `pt-[max(1rem,env(safe-area-inset-top))] md:pt-4`.
- On every other page the top bar is a **tinted panel card**: `cardVariants({ variant: "tinted" })`, `h-16 px-5`, the project name (`text-title-md`) and the address (`text-body-sm text-on-surface-variant`, desktop only). On phones it shows the overall progress bar instead of the address (`<Progress onPanel />`). It is **not sticky**; it scrolls with the page.
- The top bar is exactly as wide as the page content below it: `mx-auto w-full max-w-7xl`. On Chat it is `max-w-3xl`, matching the narrower chat panel.

### Page margins
- Every page uses the same content container: `mx-auto w-full max-w-7xl`. Chat is the one exception: its panel is `md:max-w-3xl`, with the top bar matching.
- Main padding: `p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:px-8 md:pb-8`, plus `md:pt-6` on pages with the top bar.

---

## 2. Home page sections (top to bottom, `space-y-8`)

### Project header card (default outlined card)
`Card` (default: `border border-outline-variant bg-card rounded-xl`), `px-5 py-5 md:px-7 md:py-6`, flex-wrap between two blocks:
- Left: "Active project" (`text-body-md text-on-surface-variant`), the project name `h1` (`text-headline-md sm:text-headline-lg`), the address (`text-body-lg text-on-surface-variant`), then a "Manager <name>" line with a 28px round person icon.
- Right (`w-full md:w-[380px]`): "Overall progress" + the % (`text-headline-md`), an 8px `Progress` (primary), then "Currently working on **<current stage>**".

### Stat cards: **tinted panel cards**
Grid: `grid grid-cols-2 gap-3 lg:grid-cols-4`. Each card is `Card variant="tinted" className="px-5 py-4"`:
- label `text-body-md`
- value `mt-1 text-title-lg sm:text-headline-md`, with an optional unit `ml-1 text-title-md text-on-surface-variant`
- a line `mt-1 text-body-sm text-on-surface-variant` with an optional coloured delta (`font-medium`; good = `text-success-text`, attention = `text-attention-text`) followed by a note

Client app cards:
1. **Started**: "Mar 02", note "Target: Jun 10, 2026"
2. **Stages done**: "2" + unit "/ 7", delta "On schedule" (good) or "N late" (attention)
3. **Budget spent**: "$51.2" + unit "k", delta "61% used" (good) or "↑ N% over" (attention), note "of the $84.5k plan". When over budget, the card also gets `attention` (orange outline + dot).
4. **Project manager**: "Jonas Weber", note "Primary contact". This card showed the client before.

> **Manager app:** the 4th card should show the **Client** (name, "Primary contact"), because that is the manager's counterpart. Keep the other three cards.

### Latest photos
Section header: `text-title-lg` title, a subtitle "Latest from <uploader> · <day>", and a ghost text-button link "All photos →" (`-mr-3`). Below it, 4 thumbnails in `grid max-w-2xl grid-cols-4 gap-2 md:gap-3`; the last one shows "+N".

### Stage timeline (list of default cards)
Each stage is a `Card` row: `flex items-center gap-3.5 py-3.5 pl-3.5 pr-4 sm:pr-5`:
- A 44px tile `size-11 rounded-md text-label-lg` using the status container colours: a check icon when done, otherwise the stage number. **Pending tile = white with a dashed outline** (`border border-dashed border-outline bg-status-pending-container`).
- The name (`text-title-md`, truncate) and dates (`text-body-sm text-on-surface-variant`). When late, an orange attention chip `Badge variant="attention" size="sm" icon="schedule"`: "N days late".
- On the right: a `Progress` in the stage's status tone (`w-16 sm:w-[140px]`) and the % (`w-10 text-right text-label-lg tabular-nums`). A pending bar is an empty dashed track.

### Floor plan + selected room
- The floor plan sits in a default `Card p-4`, with an inner tinted area `rounded-lg bg-surface-container p-2`. Room tiles use their status container fills. A **pending** room is white with a dashed outline.
- **Selected room:** a darker outline in the room's **own status colour** (blue in progress, red blocked, green done, grey pending), **never the primary green**. Use a clipped, non-scaling stroke (`[vector-effect:non-scaling-stroke]`) so it stays crisp.
- **Selected room panel:** a **plain default card** (white with a border), not tinted. Status-coloured tracks, like the pale blue in-progress track, washed out on the tinted surface. It contains a compact status chip and a `Progress` **in the room's status tone**: blocked = red bar on a pale red track, done = a full green bar, in progress = a blue bar on a pale blue track.

---

## 3. Status logic (applies to stages and rooms)

**State follows progress:**
- `pending` is only ever 0%.
- Above 0% it becomes `progress` (in progress); at 100% it becomes `done`.
- `blocked` is the one stored state that is kept, with whatever progress was reached when work stopped.

Derive it where the data is defined, so every screen gets it without prop changes:

```ts
export function deriveStatus(stored: Status, progress: number): Status {
  if (stored === "blocked") return "blocked";
  if (progress >= 100) return "done";
  if (progress > 0) return "progress";
  return "pending";
}
```

**Attention flag (orange):** computed, never stored, and always shown *next to* the status:
- **Late:** today > end date and the state is not `done`. Show "N days late" chips, the attention card variant on stage cards, and "N late" on the Stages done card.
- **Over budget:** spent > budget. The Budget spent card gets `attention` and "↑ N% over".
- Orange is used for nothing else.
- Rooms have no dates or budgets, so rooms never show the attention flag.

Visual cues per state:

| State | Chip | Bar | Tile / dot |
|---|---|---|---|
| Done | green container | solid green | green |
| In progress | pale blue | blue on a pale blue track | blue |
| Pending | white, dashed outline | empty dashed track | hollow ring / dashed tile |
| Blocked | pale red | red on a pale red track | red |
