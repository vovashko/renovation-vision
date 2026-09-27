import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageLoading } from "@/components/page-header";
import { ExpenseSheet } from "@/components/expense-sheet";
import { UploadSheet } from "@/components/photo-upload-sheet";
import { ClientCard } from "@/features/people/ui/client-card";
import { ClientContactSheet } from "@/features/people/ui/client-contact-sheet";
import { CrewSheet } from "@/features/people/ui/crew-sheet";
import { TeamCard } from "@/features/people/ui/team-card";
import { useCrew, useMembers } from "@/features/people/hooks";
import { budgetStatus, daysUntil } from "@/domain/attention";
import { projectIssues } from "../domain/project-issues";
import { useClientContact, useProject } from "../hooks";
import { ProjectDetailsSheet } from "./project-details-sheet";
import { ShortcutsCard, type Shortcut } from "./shortcuts-card";
import { StatusCard } from "./status-card";
// `stages`/`rooms` belong to the work feature (T-work), not yet migrated off the shared shim.
import { useRooms, useStages } from "@/lib/queries";
import type { CrewMember } from "@/lib/database.types";

type Sheet = "details" | "contact" | "photo" | "expense" | null;

/** The manager's home for a project: status and what needs attention, shortcuts, client and team. */
export function ManagerOverview({ projectId }: { projectId: string }) {
  const { t } = useTranslation(["projects"]);
  const { data: project } = useProject(projectId);
  const { data: stages } = useStages(projectId);
  const { data: rooms } = useRooms(projectId);
  const { data: members = [] } = useMembers(projectId);
  const { data: contact } = useClientContact(projectId);
  const { data: crew = [] } = useCrew(projectId);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [person, setPerson] = useState<CrewMember | "new" | null>(null);
  const sheetProps = (name: Exclude<Sheet, null>) => ({ open: sheet === name, onOpenChange: (v: boolean) => setSheet(v ? name : null) });
  const openDetails = () => setSheet("details");
  const openContact = () => setSheet("contact");
  const openNewPerson = () => setPerson("new");
  const closeSheet = () => setSheet(null);
  const closePerson = () => setPerson(null);
  const detailsSheetProps = sheetProps("details");
  const contactSheetProps = sheetProps("contact");
  const photoSheetProps = sheetProps("photo");
  const expenseSheetValue = sheet === "expense" ? "new" : null;

  if (!project || !stages || !rooms) return <PageLoading />;

  const params = { projectId };
  const budget = budgetStatus(project);
  const current = stages.find((s) => s.status === "progress");
  const done = stages.filter((s) => s.status === "done").length;
  const left = project.target_date ? daysUntil(project.target_date) : null;
  const issues = projectIssues(project, stages, rooms);

  const shortcuts: Shortcut[] = [
    { key: "photo", label: t("shortcuts.uploadPhoto"), icon: "add_a_photo", onClick: () => setSheet("photo") },
    { key: "expense", label: t("shortcuts.addExpense"), icon: "receipt_long", onClick: () => setSheet("expense") },
    { key: "chat", label: t("shortcuts.messageClient"), icon: "chat_bubble", link: { to: "/projects/$projectId/chat", params } },
    { key: "stages", label: t("shortcuts.updateStages"), icon: "checklist", link: { to: "/projects/$projectId/stages", params } },
    { key: "rooms", label: t("shortcuts.updateRooms"), icon: "floor", link: { to: "/projects/$projectId/plan", params } },
    { key: "edit", label: t("shortcuts.editProject"), icon: "edit", onClick: openDetails },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="min-w-0">
        <h1 className="text-headline-md sm:text-headline-lg">{project.name}</h1>
        <p className="text-body-lg text-on-surface-variant">{project.address}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <StatusCard
            projectId={projectId}
            scheduleStatus={project.schedule_status}
            scheduleNote={project.schedule_note}
            progress={project.overall_progress}
            currentStage={current?.name ?? null}
            stagesDone={done}
            stagesTotal={stages.length}
            targetDate={project.target_date}
            daysLeft={left}
            budgetUsedPct={budget.usedPct}
            budgetOver={budget.over}
            issues={issues}
            onOpenDetails={openDetails}
          />
        </div>
        <ShortcutsCard shortcuts={shortcuts} />
        <ClientCard
          projectId={projectId}
          clientName={project.client_name}
          contact={contact}
          appUsers={members.filter((m) => m.role === "client")}
          onEdit={openContact}
        />
        <div className="min-w-0 lg:col-span-2">
          <TeamCard managers={members.filter((m) => m.role === "manager")} crew={crew} onAdd={openNewPerson} onEdit={setPerson} />
        </div>
      </div>

      <ProjectDetailsSheet project={project} {...detailsSheetProps} />
      <ClientContactSheet projectId={projectId} contact={contact} {...contactSheetProps} />
      <UploadSheet projectId={projectId} stages={stages} rooms={rooms} {...photoSheetProps} />
      <ExpenseSheet projectId={projectId} stages={stages} expense={expenseSheetValue} onClose={closeSheet} />
      <CrewSheet projectId={projectId} person={person} onClose={closePerson} />
    </div>
  );
}
