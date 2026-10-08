# progress.tsx changes (desktop Stages screen)

1. Imports:
```ts
import { ProgressSummary, ProgressSummarySkeleton } from "@/features/work/ui/progress-summary";
import { StageCardSkeleton } from "@/components/ui/skeleton";
```

2. Replace the loading early-return:
```tsx
if (stagesLoading || roomsLoading || !stages || !rooms)
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6" role="status" aria-busy>
      <ProgressSummarySkeleton />
      <StageCardSkeleton />
      <StageCardSkeleton />
    </div>
  );
```
(PageLoading stays for other pages until they get their own skeletons.)

3. In the timeline panel, above `<StageRowList>` (inside the `stages.length > 0` branch):
```tsx
<ProgressSummary stages={stages} />
<div className="mt-6" />
```

4. Stage photos in the expanded card: pass the stage's photos as `children` of `<StageRow>` using the
existing `PhotoThumbs` (`src/features/media/ui/photo-thumbs.tsx`), max 4 with a "+N" overflow tile.
Needs a photos-by-stage query; not included here because the media hooks weren't read.
