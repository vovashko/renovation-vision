import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { materialTone, type MaterialTone } from "@/domain/materials";
import type { RoomMaterial } from "@/lib/database.types";
import { useMaterialDateLabel } from "./use-material-date-label";

/** Red = not ordered, orange = ordered, green = delivered or installed (reuses the status chip colours). */
const toneBadge: Record<MaterialTone, Pick<BadgeProps, "variant" | "icon">> = {
  red: { variant: "status-blocked" },
  orange: { variant: "attention", icon: "local_shipping" },
  green: { variant: "status-done" },
};

/** The status chip of a material, coloured by `materialTone`. */
export function MaterialStatusChip({ status }: { status: RoomMaterial["status"] }) {
  const { t } = useTranslation("work");
  return (
    <Badge size="compact" {...toneBadge[materialTone(status)]}>
      {t(`materials.status.${status}`)}
    </Badge>
  );
}

/** One material in the room view: name, quantity, status chip and its date line; `actions` is the manager's edit/remove. */
export function MaterialRow({ material, actions, className }: { material: RoomMaterial; actions?: ReactNode; className?: string }) {
  const dateLabel = useMaterialDateLabel()(material);
  const tone = materialTone(material.status);
  return (
    <li className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3", className)} data-tone={tone}>
      <div className="min-w-0">
        <div className="text-body-lg text-on-surface">{material.name}</div>
        <div className="text-body-md text-on-surface-variant">
          {material.quantity} {material.unit}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {dateLabel && <span className="text-body-md text-on-surface-variant">{dateLabel}</span>}
        <MaterialStatusChip status={material.status} />
        {actions}
      </div>
    </li>
  );
}
