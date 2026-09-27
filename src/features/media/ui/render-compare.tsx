import { useTranslation } from "react-i18next";
import { BeforeAfter } from "@/features/media/ui/before-after";

/** The "now vs. planned" before/after slider for a room's headline render, with the manager's visibility note. */
export function RenderCompare({
  roomName,
  title,
  before,
  after,
  managerNote,
}: {
  roomName: string;
  title: string;
  before: string;
  after: string;
  /** "ready" once both the render and the compare photo are shared with the client; omit for clients. */
  managerNote?: "ready" | "waiting";
}) {
  const { t } = useTranslation(["media"]);
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-title-lg">{t("renderCompare.heading", { room: roomName })}</h2>
        {managerNote && (
          <p className="text-body-md text-on-surface-variant">
            {managerNote === "ready" ? t("renderCompare.noteReady") : t("renderCompare.noteWaiting")}
          </p>
        )}
      </div>
      <div className="max-w-3xl">
        <BeforeAfter before={before} after={after} label={title} />
      </div>
    </section>
  );
}
