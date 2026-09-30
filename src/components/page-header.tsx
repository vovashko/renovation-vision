import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-headline-md text-on-surface">{title}</h1>
        {description && <p className="mt-1 text-body-lg text-on-surface-variant">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function PageLoading() {
  const { t } = useTranslation(["common"]);
  return (
    <div className="py-16 text-center text-body-md text-on-surface-variant" role="status">
      {t("common:state.loading")}
    </div>
  );
}
