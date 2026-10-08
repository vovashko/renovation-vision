import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageLoading } from "@/components/page-header";
import { ExpenseSheet } from "@/features/budget/ui/expense-sheet";
import { UploadSheet } from "@/features/media/ui/photo-upload-sheet";
import { ClientCard } from "@/features/people/ui/client-card";
import { ClientContactSheet } from "@/features/people/ui/client-contact-sheet";
import { CrewSheet } from "@/features/people/ui/crew-sheet";
import { TeamCard } from "@/features/people/ui/team-card";
import { useMembers, useProjectContacts } from "@/features/people/hooks";
import { crewOf, primaryIn } from "@/features/people/domain/contacts";
import { budgetStatus, daysUntil } from "@/domain/attention";
import { scheduleDeviationDays } from "@/domain/dates";
import { projectIssues } from "../domain/project-issues";
import { useProject } from "../hooks";
import { ProjectDetailsSheet } from "./project-details-sheet";
import { ShortcutsCard, type Shortcut } from "./shortcuts-card";
import { StatusCard } from "./status-card";
import { useRooms, useStages } from "@/features/work/hooks";
import type { ProjectContact } from "@/lib/database.types";

type Sheet = "details" | "contact" | "photo" | "expense" | null;

/** The manager's home for a project: status and what needs attention, shortcuts, client and team. */
export function ManagerOverview({ projectId }: { projectId: string }) {
  const { t } = useTranslation(["projects"]);
  const { data: project } = useProject(projectId);
  const { data: stages } = useStages(projectId);
  const { data: rooms } = useRooms(projectId);
  const { data: members = [] } = useMembers(projectId);
  const { data: links = [] } = useProjectContacts(projectId);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [person, setPerson] = useState<ProjectContact | "new" | null>(null);
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
  const crew = crewOf(links);
  const client = primaryIn(links, "client");
  const clientUsers = members.filter((m) => m.role === "client");

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
            targetDeviationDays={scheduleDeviationDays(project.planned_target_date, project.target_date)}
            daysLeft={left}
            budgetUsedPct={budget.usedPct}
            budgetOver={budget.over}
            currency={project.currency}
            issues={issues}
            onOpenDetails={openDetails}
          />
        </div>
        <ShortcutsCard shortcuts={shortcuts} />
        <ClientCard projectId={projectId} client={client} appUsers={clientUsers} onEdit={openContact} />
        <div className="min-w-0 lg:col-span-2">
          <TeamCard managers={members.filter((m) => m.role === "manager")} crew={crew} onAdd={openNewPerson} onEdit={setPerson} />
        </div>
      </div>

      <ProjectDetailsSheet project={project} {...detailsSheetProps} />
      <ClientContactSheet
        projectId={projectId}
        client={client}
        defaultName={clientUsers.map((m) => m.profile.full_name).join(" & ")}
        {...contactSheetProps}
      />
      <UploadSheet projectId={projectId} stages={stages} rooms={rooms} {...photoSheetProps} />
      <ExpenseSheet projectId={projectId} stages={stages} expense={expenseSheetValue} onClose={closeSheet} />
      <CrewSheet projectId={projectId} links={links} person={person} onClose={closePerson} />
    </div>
  );
}
