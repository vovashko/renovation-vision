import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { PageHeader, PageLoading } from "@/components/page-header";
import { AddMemberForm } from "@/features/people/ui/add-member-form";
import { MemberItem } from "@/features/people/ui/member-row";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { keys, useMembers, useSave } from "@/lib/queries";
import type { Member, ProjectRole } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/team")({
  head: () => ({
    meta: [{ title: "Team — RenoVision" }, { name: "description", content: "Who can see and manage this project." }],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { projectId } = Route.useParams();
  const { userId } = useAuth();
  const { data: members, isLoading } = useMembers(projectId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("client");
  const inv = { invalidate: [keys.members(projectId)] };
  const add = useSave(projectId, () => api.addMember(projectId, email.trim(), role), { ...inv, success: `Added ${email.trim()}` });
  const remove = useSave(projectId, (m: Member) => api.removeMember(projectId, m.user_id), {
    ...inv,
    success: (m) => `Removed ${m.profile.full_name}`,
  });

  if (isLoading || !members) return <PageLoading />;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <PageHeader title="Team" description="Clients see visible project data in the RenoVision app. Managers can edit everything here." />

      <AddMemberForm
        email={email}
        onEmailChange={setEmail}
        role={role}
        onRoleChange={setRole}
        pending={add.isPending}
        onSubmit={() => add.mutate(undefined, { onSuccess: () => setEmail("") })}
      />

      {members.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon" icon="group" />
            <EmptyDescription>No members yet.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup>
          {members.map((m) => (
            <MemberItem
              key={m.user_id}
              member={m}
              isSelf={m.user_id === userId}
              onRemove={() => confirm(`Remove ${m.profile.full_name} from this project?`) && remove.mutate(m)}
            />
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
