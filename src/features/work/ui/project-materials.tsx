import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn, type DataTableEmpty } from "@/shared/ui/data-table";
import { useFormat } from "@/i18n";
import { canCreateExpense, materialTotal } from "@/domain/materials";
import { useProjectMaterials } from "../hooks/room-view";
import type { ProjectMaterial } from "../data/room-view.repo";
import { MarkDeliveredSheet } from "./mark-delivered-sheet";
import { MaterialStatusChip } from "./material-row";
import { useMaterialDateLabel } from "./use-material-date-label";
import type { Room } from "@/lib/database.types";

/**
 * Every material of the project across rooms, for managers: status, dates, price and a link to its room. Read-only
 * (materials are edited in the room), except "Mark delivered", which creates the expense for a material that has none.
 */
export function ProjectMaterials({ projectId, rooms, currency }: { projectId: string; rooms: Room[]; currency: string }) {
  const { t } = useTranslation(["work"]);
  const format = useFormat();
  const dateLabel = useMaterialDateLabel();
  const { data: materials = [] } = useProjectMaterials(projectId);
  const [delivering, setDelivering] = useState<ProjectMaterial | null>(null);

  const columns: DataTableColumn<ProjectMaterial>[] = [
    {
      key: "name",
      header: t("work:materials.project.material"),
      cell: (m) => (
        <>
          <div className="font-medium">{m.name}</div>
          <div className="text-body-sm text-on-surface-variant">
            {m.quantity} {m.unit}
          </div>
        </>
      ),
    },
    {
      key: "room",
      header: t("work:materials.project.room"),
      cell: (m) => {
        const room = rooms.find((r) => r.id === m.room_id);
        return room ? (
          <Link to="/projects/$projectId/rooms/$roomId" params={{ projectId, roomId: room.id }} className="text-primary">
            {room.name}
          </Link>
        ) : (
          <span className="text-on-surface-variant">{t("work:materials.project.noRoom")}</span>
        );
      },
    },
    {
      key: "status",
      header: t("work:materials.project.status"),
      cell: (m) => (
        <span className="flex flex-wrap items-center gap-2">
          <MaterialStatusChip status={m.status} />
          <span className="text-body-sm text-on-surface-variant">{dateLabel(m)}</span>
        </span>
      ),
    },
    {
      key: "total",
      header: t("work:materials.project.total"),
      cell: (m) => format.money(materialTotal(m), currency),
      align: "end",
      className: "whitespace-nowrap tabular-nums",
    },
    {
      key: "expense",
      header: <span className="sr-only">{t("work:materials.project.expense")}</span>,
      align: "end",
      cell: (m) =>
        canCreateExpense(m) ? (
          <Button variant="outline" size="sm" onClick={() => setDelivering(m)}>
            {t("work:materials.project.markDelivered")}
          </Button>
        ) : (
          <Badge size="compact" variant="status-done">
            {t("work:materials.project.paid")}
          </Badge>
        ),
    },
  ];

  const empty: DataTableEmpty = { icon: "inventory_2", title: t("work:materials.project.empty") };

  return (
    <section aria-labelledby="project-materials-heading">
      <h2 id="project-materials-heading" className="mb-3 text-title-lg">
        {t("work:materials.project.heading")}
      </h2>
      <DataTable rows={materials} getRowKey={(m) => m.id} columns={columns} className="min-w-[720px]" empty={empty} />
      <MarkDeliveredSheet projectId={projectId} material={delivering} onClose={() => setDelivering(null)} />
    </section>
  );
}
