import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChatAvatar } from "@/components/chat";
import { Field, NativeSelect } from "@/components/manager/form-sheet";
import { PageHeader, PageLoading } from "@/components/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { keys, useMembers, useSave } from "@/lib/queries";
import { dateTime } from "@/lib/format";
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

      <Card className="p-5">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(undefined, { onSuccess: () => setEmail("") });
          }}
        >
          <Field id="tm-email" label="Add by email">
            <Input
              id="tm-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
              aria-describedby="tm-email-hint"
            />
          </Field>
          {/* A dropdown so more roles can be added later. */}
          <Field id="tm-role" label="Role">
            <NativeSelect id="tm-role" value={role} onChange={(e) => setRole(e.target.value as ProjectRole)}>
              <option value="client">Client</option>
              <option value="manager">Manager</option>
            </NativeSelect>
          </Field>
          <Button type="submit" disabled={!email.trim() || add.isPending} className="gap-2">
            <Icon name="person_add" size={20} /> Add
          </Button>
        </form>
        {/* Below the whole row so the fields and the button share one baseline. */}
        <p id="tm-email-hint" className="mt-2 text-body-sm text-on-surface-variant">
          They need a RenoVision account first.
        </p>
      </Card>

      {members.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high">
            <Icon name="group" size={24} className="text-on-surface-variant" />
          </div>
          <p className="mt-2 max-w-xs text-body-md text-on-surface-variant">No members yet.</p>
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-outline-variant">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 p-4">
                <ChatAvatar name={m.profile.full_name || "?"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {m.profile.full_name}
                    {m.user_id === userId && <span className="text-on-surface-variant"> (you)</span>}
                  </div>
                  <div className="text-body-sm text-on-surface-variant">
                    {m.last_read_at ? `Last read chat ${dateTime(m.last_read_at)}` : "Hasn't opened the chat yet"}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-label-md font-medium ${m.role === "manager" ? "bg-foreground text-background" : "bg-accent text-accent-foreground"}`}
                >
                  {m.role === "manager" ? "Manager" : "Client"}
                </span>
                {m.user_id !== userId && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    aria-label={`Remove ${m.profile.full_name}`}
                    onClick={() => confirm(`Remove ${m.profile.full_name} from this project?`) && remove.mutate(m)}
                  >
                    <Icon name="close" size={20} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
