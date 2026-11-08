import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { usePhotos } from "@/features/media/hooks";
import { PhotoThumbs } from "@/features/media/ui/photo-thumbs";
import { useFormat } from "@/i18n";
import { cn } from "@/lib/utils";
import { latestVisible } from "../domain/diary";
import { useDiaryEntries } from "../hooks/diary";

/** How many entries the client Overview shows before sending the client to the full diary. */
const SITE_CARD_ENTRIES = 3;

/** The diary section on the Progress page (its element id). */
const DIARY_ANCHOR = "diary";

const sectionLink = cn(buttonVariants({ variant: "ghost" }), "-mr-3 shrink-0");

/** The client Overview's "From the site" card: the latest few visible diary entries, linking to the Progress diary. Renders nothing without any. */
export function DiarySiteCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation(["work"]);
  const format = useFormat();
  const { data: entries = [] } = useDiaryEntries(projectId);
  const { data: photos = [] } = usePhotos(projectId);
  const latest = latestVisible(entries, SITE_CARD_ENTRIES);
  if (latest.length === 0) return null;

  return (
    <section aria-labelledby="from-the-site">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="from-the-site" className="text-title-lg">
          {t("work:diary.siteCard.title")}
        </h2>
        <Link
          to="/projects/$projectId/progress"
          params={{ projectId }}
          search={{ view: "timeline" }}
          hash={DIARY_ANCHOR}
          className={sectionLink}
        >
          {t("work:diary.siteCard.all")}
          <Icon name="arrow_forward" size={20} />
        </Link>
      </div>
      <ul className="space-y-3">
        {latest.map((entry) => {
          const entryPhotos = photos.filter((p) => p.progress_entry_id === entry.id);
          return (
            <li key={entry.id}>
              <Card className="px-5 py-4">
                <p className="text-label-md text-on-surface-variant">{format.date(entry.entry_date, "long")}</p>
                <p className="mt-1 line-clamp-3 text-body-lg whitespace-pre-line text-on-surface">{entry.note}</p>
                {entryPhotos.length > 0 && <PhotoThumbs photos={entryPhotos} max={4} className="mt-3 grid grid-cols-4 gap-2" />}
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
