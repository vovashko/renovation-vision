import { Link, type LinkProps } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

/** `label` is already translated: the caller knows which shortcut it is (see `ManagerOverview`). */
export type Shortcut = { key: string; label: string; icon: string; onClick?: () => void; link?: Pick<LinkProps, "to" | "params"> };

const tile =
  "flex min-h-24 flex-col items-start justify-between gap-3 rounded-2xl bg-surface-container-lowest p-4 text-left text-label-lg text-on-surface transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-surface active:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** The manager overview's daily-task shortcuts: tinted panel, white rounded tiles. */
export function ShortcutsCard({ shortcuts }: { shortcuts: Shortcut[] }) {
  const { t } = useTranslation(["projects"]);
  return (
    <Card variant="tinted" className="flex flex-col gap-4 p-5 md:p-6" aria-labelledby="shortcuts-heading">
      <h2 id="shortcuts-heading" className="text-title-lg">
        {t("shortcuts.heading")}
      </h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
        {shortcuts.map((s) => {
          const body = (
            <>
              <Icon name={s.icon} size={24} />
              {s.label}
            </>
          );
          return s.link ? (
            <Link key={s.key} {...s.link} className={tile}>
              {body}
            </Link>
          ) : (
            <button key={s.key} type="button" onClick={s.onClick} className={tile}>
              {body}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
