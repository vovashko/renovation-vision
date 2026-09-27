import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Lightbox } from "@/features/media/ui/lightbox";
import { focusRing } from "@/components/ui/focus-ring";
import { cn } from "@/lib/utils";
import { useFormat } from "@/i18n";
import { toLightboxItem } from "@/features/media/domain/photo-helpers";
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
  const { t } = useTranslation(["media"]);
  const format = useFormat();
  const [open, setOpen] = useState<number | null>(null);
  const shown = photos.slice(0, max);
  const extra = photos.length - shown.length;
  const fallbackCaption = t("photo.fallbackCaption");
  const items = photos.map((p) => toLightboxItem(p, { fallbackTitle: fallbackCaption, subtitle: format.date(p.taken_at, "dayTime") }));

  return (
    <>
      <ul className={className}>
        {shown.map((p, i) => (
          <li key={p.id} className="relative">
            <button
              onClick={() => setOpen(i)}
              aria-label={t("photoCard.openAria", { caption: p.caption || fallbackCaption })}
              className={cn("block w-full overflow-hidden rounded-sm", focusRing)}
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
      <Lightbox items={items} index={open} onClose={() => setOpen(null)} />
    </>
  );
}
