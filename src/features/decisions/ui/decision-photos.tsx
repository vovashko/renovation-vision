import { useTranslation } from "react-i18next";
import type { DecisionPhoto } from "@/lib/database.types";

/** A case's photos as a grid of thumbnails; each opens the full image in a new tab. */
export function DecisionPhotos({ photos }: { photos: DecisionPhoto[] }) {
  const { t } = useTranslation(["decisions"]);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo, index) => {
        const label = t("decisions:detail.openPhoto", { index: index + 1 });
        return (
          <a
            key={photo.id}
            href={photo.url}
            target="_blank"
            rel="noreferrer"
            aria-label={label}
            className="block overflow-hidden rounded-md"
          >
            <img src={photo.url} alt={label} loading="lazy" className="aspect-square w-full object-cover" />
          </a>
        );
      })}
    </div>
  );
}
