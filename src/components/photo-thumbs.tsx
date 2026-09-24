import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { SitePhoto } from "@/lib/media-data";
import { toLightbox } from "@/lib/photo-helpers";
import { Lightbox } from "@/components/lightbox";

/** Friendly placeholder for a stage, room or filter with no photos yet. */
export function EmptyPhotos({ text, compact = false }: { text: string; compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed bg-card p-3 text-sm text-muted-foreground">
        <Icon name="photo_camera" size={20} />
        {text}
      </div>
    );
  }
  return (
    <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed bg-card p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon name="photo_camera" className="text-muted-foreground" />
      </div>
      <p className="mt-3 max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/** Row of square thumbnails that open the shared lightbox. */
export function PhotoThumbs({
  photos,
  max = 4,
  className = "grid grid-cols-4 gap-2",
}: {
  photos: SitePhoto[];
  max?: number;
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const shown = photos.slice(0, max);
  const extra = photos.length - shown.length;

  return (
    <>
      <ul className={className}>
        {shown.map((p, i) => (
          <li key={p.id} className="relative">
            <button
              onClick={() => setOpen(i)}
              aria-label={`Open photo: ${p.caption}`}
              className="block w-full overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img
                src={p.src}
                alt={p.alt}
                loading="lazy"
                width={256}
                height={256}
                className="aspect-square w-full object-cover transition-transform hover:scale-105"
              />
              {extra > 0 && i === shown.length - 1 && (
                <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-foreground/55 text-sm font-semibold text-background">
                  +{extra}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <Lightbox items={photos.map(toLightbox)} index={open} onClose={() => setOpen(null)} />
    </>
  );
}
