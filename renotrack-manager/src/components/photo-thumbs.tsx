import { useState } from "react";
import { Lightbox, type LightboxItem } from "@/components/ui/lightbox";
import type { Photo } from "@/lib/database.types";

/** Row of square thumbnails that open the lightbox. The last one shows "+N" when there are more. */
export function PhotoThumbs({
  photos,
  toItem,
  max = 4,
  className = "grid grid-cols-4 gap-2",
}: {
  photos: Photo[];
  toItem: (p: Photo) => LightboxItem;
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
              aria-label={`Open photo: ${p.caption || "site photo"}`}
              className="relative block w-full overflow-hidden rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {p.url ? (
                <img src={p.url} alt={p.alt} loading="lazy" width={256} height={256} className="aspect-square w-full object-cover" />
              ) : (
                <span className="block aspect-square w-full bg-surface-container-high" />
              )}
              {p.status === "draft" && !(extra > 0 && i === shown.length - 1) && (
                <span className="absolute top-1.5 left-1.5 rounded-full bg-surface-container-lowest px-2 py-0.5 text-label-sm text-on-surface">Draft</span>
              )}
              {extra > 0 && i === shown.length - 1 && (
                <span className="absolute inset-0 flex items-center justify-center bg-inverse-surface/60 text-title-md text-inverse-on-surface">
                  +{extra}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <Lightbox items={photos.map(toItem)} index={open} onClose={() => setOpen(null)} />
    </>
  );
}
