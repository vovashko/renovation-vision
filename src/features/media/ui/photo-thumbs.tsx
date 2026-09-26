import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Lightbox } from "@/components/lightbox";
import { toLightboxItem } from "@/lib/photo-helpers";
import type { Photo } from "@/lib/database.types";

/** Row of square thumbnails that open the shared lightbox. Used for compact previews (overview, plan, stages). */
export function PhotoThumbs({
  photos,
  max = 4,
  className = "grid grid-cols-4 gap-2",
}: {
  photos: Photo[];
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
              className="block w-full overflow-hidden rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {p.url ? (
                <img src={p.url} alt={p.alt} loading="lazy" width={256} height={256} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-surface-container-high text-body-sm text-on-surface-variant">
                  <Icon name="broken_image" size={20} />
                </div>
              )}
              {extra > 0 && i === shown.length - 1 && (
                <span className="absolute inset-0 flex items-center justify-center rounded-sm bg-inverse-surface/60 text-title-md text-inverse-on-surface">
                  +{extra}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <Lightbox items={photos.map((p) => toLightboxItem(p))} index={open} onClose={() => setOpen(null)} />
    </>
  );
}
