// Pure helpers for the Photos and Design pages: filtering, date grouping and the lightbox item
// shape. Framework-free (no React, no Supabase, no i18n) so they're easy to unit test in isolation;
// locale-aware text (day labels, fallback captions) is supplied by the caller.
import type { Photo } from "@/lib/database.types";

export type PhotoFilter = { stageId?: string | null; roomId?: string | null };

/** Filters by stage and/or room. "all" (or an empty value) on either dimension means "no filter". */
export function filterPhotos(photos: Photo[], { stageId, roomId }: PhotoFilter = {}): Photo[] {
  return photos.filter(
    (p) => (!stageId || stageId === "all" || p.stage_id === stageId) && (!roomId || roomId === "all" || p.room_id === roomId),
  );
}

export type PhotoGroup = { date: string; items: Photo[] };

const calendarDayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/**
 * Groups consecutive photos sharing a calendar day. Input order is preserved (photos are expected
 * to already be sorted newest first, as `usePhotos` returns them) — this never re-sorts. Each
 * group's `date` is its first photo's `taken_at`, for the caller to format with `useFormat().dayLabel`.
 */
export function groupPhotosByDate(photos: Photo[]): PhotoGroup[] {
  const groups: PhotoGroup[] = [];
  let lastKey: string | null = null;
  for (const p of photos) {
    const key = calendarDayKey(p.taken_at);
    const last = groups[groups.length - 1];
    if (last && lastKey === key) last.items.push(p);
    else groups.push({ date: p.taken_at, items: [p] });
    lastKey = key;
  }
  return groups;
}

/** Shared shape for the Photos page grid and lightbox: a photo plus its stage/room tags. */
export type LightboxItem = { src: string; alt: string; title: string; subtitle?: string; tags?: string[] };

/**
 * Builds a `LightboxItem` from a photo. `fallbackTitle` and `subtitle` are supplied by the caller
 * (translated text, and a locale-formatted date) so this stays pure.
 */
export function toLightboxItem(p: Photo, opts: { fallbackTitle: string; subtitle?: string; tags?: string[] }): LightboxItem {
  return { src: p.url, alt: p.alt, title: p.caption || opts.fallbackTitle, subtitle: opts.subtitle, tags: opts.tags };
}
