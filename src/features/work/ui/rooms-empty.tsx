import { useTranslation } from "react-i18next";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function RoomsEmpty({ className }: { className?: string }) {
  const { t } = useTranslation("work");
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon" icon="floor" />
        <EmptyTitle>{t("roomsEmpty.title")}</EmptyTitle>
        <EmptyDescription>{t("roomsEmpty.description")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
