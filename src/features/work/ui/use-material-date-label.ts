import { useTranslation } from "react-i18next";
import { materialDateInfo } from "@/domain/materials";
import { useFormat } from "@/i18n";
import type { RoomMaterial } from "@/lib/database.types";

/** "Order by … at the latest" / "Delivery …" / "Delivered …": the date line of a material, or null when unknown. */
export function useMaterialDateLabel() {
  const { t } = useTranslation("work");
  const format = useFormat();
  return (m: Pick<RoomMaterial, "status" | "order_by_date" | "delivery_date">): string | null => {
    const info = materialDateInfo(m);
    return info ? t(`materials.date.${info.kind}`, { date: format.date(info.date, "short") }) : null;
  };
}
