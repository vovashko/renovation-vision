import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { ItemGroup } from "@/components/ui/item";
import { PageHeader, PageLoading } from "@/components/page-header";
import { AddTeamPersonSheet } from "@/features/people/ui/add-team-person-sheet";
import { CrewRows } from "@/features/people/ui/crew-row";
import { CrewSheet } from "@/features/people/ui/crew-sheet";
import { PendingInvites } from "@/features/people/ui/invite-list";
import { MemberItem } from "@/features/people/ui/member-row";
import { useMembers, useProjectContacts, useRemoveMember } from "@/features/people/hooks";
import { crewOf } from "@/features/people/domain/contacts";
import { useConfirm } from "@/shared/ui/use-confirm";
import { useAuth } from "@/lib/auth";
import type { Member, ProjectContact } from "@/lib/database.types";

export const Route = createFileRoute("/_authed/projects/$projectId/team")({
  head: () => ({
    meta: [{ title: "Team — RenoVision" }, { name: "description", content: "Who can see and manage this project." }],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { t } = useTranslation(["people"]);
  const { projectId } = Route.useParams();
  const { userId } = useAuth();
  const { data: members, isLoading } = useMembers(projectId);
  const { data: links = [] } = useProjectContacts(projectId);
  const confirm = useConfirm();
  const remove = useRemoveMember(projectId);
  const [adding, setAdding] = useState(false);
  const [person, setPerson] = useState<ProjectContact | null>(null);

  if (isLoading || !members) return <PageLoading />;

  const managers = members.filter((m) => m.role === "manager");
  const crew = crewOf(links);

  const removeMember = async (member: Member) => {
    if (await confirm({ title: t("team.removeConfirmTitle", { name: member.profile.full_name }), destructive: true })) {
      remove.mutate(member);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <PageHeader
        title={t("team.pageTitle")}
        description={t("team.pageDescription")}
        actions={
          <Button onClick={() => setAdding(true)} className="gap-2">
            <Icon name="person_add" size={20} /> {t("team.addPerson")}
          </Button>
        }
      />

      <p className="text-body-md text-on-surface-variant">
        {t("team.clientNote")}{" "}
        <Link to="/projects/$projectId" params={{ projectId }} className="text-primary underline">
          {t("team.clientNoteLink")}
        </Link>
      </p>

      {managers.length === 0 && crew.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon" icon="group" />
            <EmptyDescription>{t("team.emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ItemGroup>
            {managers.map((m) => (
              <MemberItem key={m.user_id} member={m} isSelf={m.user_id === userId} onRemove={() => removeMember(m)} />
            ))}
          </ItemGroup>
          <CrewRows crew={crew} onEdit={setPerson} />
        </>
      )}

      <PendingInvites projectId={projectId} />

      <AddTeamPersonSheet projectId={projectId} links={links} open={adding} onOpenChange={setAdding} />
      <CrewSheet projectId={projectId} person={person} onClose={() => setPerson(null)} />
    </div>
  );
}
