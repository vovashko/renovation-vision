# stage-row.tsx change (read-only checkbox)

Replace the local `CheckBox` with the shared one, and use the read-only look when tasks can't be toggled:

```tsx
import { CheckboxReadOnly } from "@/components/ui/checkbox";

function CheckBox({ done, readOnly }: { done: boolean; readOnly?: boolean }) {
  if (readOnly) return <CheckboxReadOnly checked={done} />;
  return done ? (
    <span className="grid size-[22px] shrink-0 place-items-center rounded-[7px] bg-primary text-on-primary">
      <Icon name="check" size={16} />
    </span>
  ) : (
    <span aria-hidden className="size-[22px] shrink-0 rounded-[7px] border-[1.5px] border-outline" />
  );
}
```

In the non-interactive branch: `<CheckBox done={t2.done} readOnly />`, and give the `<li>`
`aria-label` / sr-only text for done state (e.g. reuse an existing "done" string) since the tile is decorative.
