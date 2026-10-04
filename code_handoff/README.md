# RenoVision: proposed components → code

Drop-in files for `vovashko/renovation-vision@main`, written against the current source (Oct 4, 2026).
Paths mirror the repo. Files ending in `.patch.md` / `.patch.css` are edits to apply by hand.

| Design item | File | Type |
|---|---|---|
| Button: loading (all variants) | src/components/ui/button.tsx | replace |
| Checkbox: read-only | src/components/ui/checkbox.tsx (+ stage-row.tsx.patch.md) | replace + patch |
| Banner | src/components/ui/banner.tsx | new |
| Alert (v5 restyle) | src/components/ui/alert.tsx | replace (API compatible; adds `success` variant + `icon` prop) |
| Toast (v5 restyle) | src/components/ui/sonner.tsx | replace |
| Skeleton | src/components/ui/skeleton.tsx + styles.css.patch.css | replace + patch |
| Stages screen, desktop | src/features/work/ui/progress-summary.tsx + progress.tsx.patch.md | new + patch |

## Usage
```tsx
<Button loading={save.isPending}><Icon name="add" size={20} /> Add stage</Button>
<Banner variant="attention" icon="euro" title="Kitchen is 4% over budget." action={<Button variant="ghost" size="sm">Review</Button>}>Review the latest expenses.</Banner>
<Alert variant="success"><AlertTitle>Stage marked complete</AlertTitle><AlertDescription>The client has been notified.</AlertDescription></Alert>
toast("Task removed", { action: { label: "Undo", onClick: undo }, duration: 8000 });
```

## New i18n keys (`work` namespace, English)
```json
{ "summary": { "stagesDone": "Stages done", "overallProgress": "Overall progress", "nextDeadline": "Next deadline", "allDone": "All stages done" } }
```
Add to every locale the app ships.

## Notes
- Existing `<Alert>` callers keep working: `variant="destructive"` is unchanged by name; an icon is now rendered by default (pass `icon={null}` to opt out).
- Toaster uses Sonner 2's `unstyled` + `mobileOffset`; check where `<Toaster />` is mounted still renders once.
- Not included: "↑ 1 since last week" delta on Stages done (needs history) and stage photos (needs a photos-by-stage query).
- Run `bun run verify` after applying.

## Prompt for Claude Code
> Apply the files in code_handoff/ to this repo: copy the replace/new files to their paths, apply each .patch.md / .patch.css by hand, add the i18n keys to all locales, then run `bun run verify` and fix any type or lint errors.
