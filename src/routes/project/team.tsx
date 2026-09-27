import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { PageHeader, PageLoading } from "@/components/page-header";
import { AddMemberForm } from "@/features/people/ui/add-member-form";
import { MemberItem } from "@/features/people/ui/member-row";
import { useAddMember, useMembers, useRemoveMember } from "@/features/people/hooks";
import type { MemberFormValues } from "@/features/people/domain/schemas";
import { useConfirm } from "@/shared/ui/use-confirm";
import { useAuth } from "@/lib/auth";
import type { Member } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/team")({
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
  const confirm = useConfirm();
  const add = useAddMember(projectId);
  const remove = useRemoveMember(projectId);

  if (isLoading || !members) return <PageLoading />;

  const removeMember = async (member: Member) => {
    if (await confirm({ title: t("team.removeConfirmTitle", { name: member.profile.full_name }), destructive: true })) {
      remove.mutate(member);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <PageHeader title={t("team.pageTitle")} description={t("team.pageDescription")} />

      <AddMemberForm onSubmit={(values: MemberFormValues) => add.mutate(values)} pending={add.isPending} />

      {members.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon" icon="group" />
            <EmptyDescription>{t("team.emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup>
          {members.map((m) => (
            <MemberItem key={m.user_id} member={m} isSelf={m.user_id === userId} onRemove={() => removeMember(m)} />
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
