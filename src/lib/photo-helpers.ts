// Pure helpers for the Photos and Design pages: filtering and date grouping.
// Kept framework-free so they're easy to unit test in isolation.
import type { LightboxItem } from "@/components/lightbox";
import type { Photo } from "@/lib/database.types";
import { dateTime } from "@/lib/format";

export type PhotoFilter = { stageId?: string | null; roomId?: string | null };

/** Filters by stage and/or room. "all" (or an empty value) on either dimension means "no filter". */
export function filterPhotos(photos: Photo[], { stageId, roomId }: PhotoFilter = {}): Photo[] {
  return photos.filter(
    (p) => (!stageId || stageId === "all" || p.stage_id === stageId) && (!roomId || roomId === "all" || p.room_id === roomId),
  );
}

/** "Today" / "Yesterday" / "Mar 02" relative to `now` (defaults to the real current time). */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

export type PhotoGroup = { label: string; items: Photo[] };

/**
 * Groups consecutive photos sharing a day label. Input order is preserved (photos are expected to
 * already be sorted newest first, as `usePhotos` returns them) — this never re-sorts.
 */
export function groupPhotosByDate(photos: Photo[], now: Date = new Date()): PhotoGroup[] {
  const groups: PhotoGroup[] = [];
  for (const p of photos) {
    const label = dayLabel(p.taken_at, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(p);
    else groups.push({ label, items: [p] });
  }
  return groups;
}

/** Shared shape for the Photos page grid and lightbox: a photo plus its stage/room tags. */
export function toLightboxItem(p: Photo, tags: string[] = []): LightboxItem {
  return { src: p.url, alt: p.alt, title: p.caption || "Site photo", subtitle: dateTime(p.taken_at), tags };
}
