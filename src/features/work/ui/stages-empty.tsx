import { useTranslation } from "react-i18next";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function StagesEmpty({ className }: { className?: string }) {
  const { t } = useTranslation("work");
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon" icon="checklist" />
        <EmptyTitle>{t("stagesEmpty.title")}</EmptyTitle>
        <EmptyDescription>{t("stagesEmpty.description")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
