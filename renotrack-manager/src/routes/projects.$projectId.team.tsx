import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatAvatar } from "@/components/ui/chat";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, selectCls } from "@/components/form-sheet";
import { PageHeader, PageLoading } from "@/components/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { keys, useMembers, useSave } from "@/lib/queries";
import { dateTime } from "@/lib/format";
import type { Member, ProjectRole } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/team")({
  head: () => ({
    meta: [
      { title: "Team — RenoTrack Manager" },
      { name: "description", content: "Who can see and manage this project." },
    ],
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
  const remove = useSave(projectId, (m: Member) => api.removeMember(projectId, m.user_id), { ...inv, success: (m) => `Removed ${m.profile.full_name}` });

  if (isLoading || !members) return <PageLoading />;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <PageHeader title="Team" description="Clients see visible project data in the RenoTrack app. Managers can edit everything here." />

      <form
        className="grid gap-3 rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)] sm:grid-cols-[1fr_160px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(undefined, { onSuccess: () => setEmail("") });
        }}
      >
        <Field id="tm-email" label="Add by email" hint="They need a RenoTrack account first.">
          <Input id="tm-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </Field>
        <Field id="tm-role" label="Role">
          <select id="tm-role" value={role} onChange={(e) => setRole(e.target.value as ProjectRole)} className={selectCls}>
            <option value="client">Client</option>
            <option value="manager">Manager</option>
          </select>
        </Field>
        <Button type="submit" disabled={!email.trim() || add.isPending} className="min-h-11 gap-2 sm:mb-6"><UserPlus className="h-4 w-4" /> Add</Button>
      </form>

      {members.length === 0 ? (
        <EmptyState icon={Users} text="No members yet." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card shadow-[var(--shadow-soft)]">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 p-4">
              <ChatAvatar name={m.profile.full_name || "?"} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.profile.full_name}{m.user_id === userId && <span className="text-muted-foreground"> (you)</span>}</div>
                <div className="text-xs text-muted-foreground">{m.last_read_at ? `Last read chat ${dateTime(m.last_read_at)}` : "Hasn't opened the chat yet"}</div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${m.role === "manager" ? "bg-foreground text-background" : "bg-accent text-accent-foreground"}`}>
                {m.role === "manager" ? "Manager" : "Client"}
              </span>
              {m.user_id !== userId && (
                <Button size="icon" variant="ghost" className="h-9 w-9" aria-label={`Remove ${m.profile.full_name}`} onClick={() => confirm(`Remove ${m.profile.full_name} from this project?`) && remove.mutate(m)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
