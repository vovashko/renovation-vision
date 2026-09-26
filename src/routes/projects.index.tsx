import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FolderPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormSheet } from "@/components/manager/form-sheet";
import { EmptyState } from "@/components/empty-state";
import { ProgressBar } from "@/components/progress-bar";
import { PageHeader, PageLoading } from "@/components/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useProjects } from "@/lib/queries";
import { longDate, money, scheduleFill, scheduleLabel } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — RenoTrack" },
      { name: "description", content: "All renovation projects you manage." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { profile } = useAuth();
  const { data: projects, isLoading } = useProjects();
  const [open, setOpen] = useState(false);
  if (profile?.account_type !== "manager") return <Navigate to="/" replace />;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Your projects"
        description="Everything you update here appears in the client's RenoTrack app."
        actions={<Button onClick={() => setOpen(true)} className="min-h-11 gap-2"><Plus className="h-4 w-4" /> New project</Button>}
      />
      {isLoading ? (
        <PageLoading />
      ) : !projects?.length ? (
        <EmptyState className="mt-6" icon={FolderPlus} title="No projects yet" text="Create a project, then invite your client from the Team page." />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-elegant)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{p.name}</h2>
                  <p className="text-sm text-muted-foreground">{p.address}</p>
                </div>
                <span className="shrink-0 rounded-full px-3 py-1 text-xs font-medium text-white" style={{ background: scheduleFill[p.schedule_status] }}>
                  {scheduleLabel[p.schedule_status]}
                </span>
              </div>
              <div className="mt-5 flex items-end justify-between text-sm">
                <span className="text-muted-foreground">{p.current_stage ? `Now: ${p.current_stage}` : "Overall progress"}</span>
                <span className="font-semibold">{p.overall_progress}%</span>
              </div>
              <ProgressBar value={p.overall_progress} className="mt-2" />
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Client: <span className="text-foreground">{p.client_name || "—"}</span></span>
                <span>Target: <span className="text-foreground">{longDate(p.target_date)}</span></span>
                <span>Spent: <span className="text-foreground">{money(p.spent)} / {money(p.budget)}</span></span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <NewProjectSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NewProjectSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", address: "", client_name: "", start_date: "", target_date: "", budget: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const id = await api.createProject({
        name: form.name.trim(),
        address: form.address.trim(),
        client_name: form.client_name.trim(),
        start_date: form.start_date || null,
        target_date: form.target_date || null,
        budget: Number(form.budget) || 0,
      });
      await qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
      onOpenChange(false);
      navigate({ to: "/projects/$projectId", params: { projectId: id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title="New project" description="You become its manager. Add stages, rooms and your client next.">
        <form onSubmit={submit} className="space-y-4">
          <Field id="np-name" label="Project name"><Input id="np-name" required value={form.name} onChange={set("name")} className="h-11" /></Field>
          <Field id="np-address" label="Address"><Input id="np-address" value={form.address} onChange={set("address")} className="h-11" /></Field>
          <Field id="np-client" label="Client name (as shown in the app)"><Input id="np-client" value={form.client_name} onChange={set("client_name")} className="h-11" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="np-start" label="Start"><Input id="np-start" type="date" value={form.start_date} onChange={set("start_date")} className="h-11" /></Field>
            <Field id="np-target" label="Target"><Input id="np-target" type="date" value={form.target_date} onChange={set("target_date")} className="h-11" /></Field>
          </div>
          <Field id="np-budget" label="Budget ($)"><Input id="np-budget" type="number" min={0} step={100} value={form.budget} onChange={set("budget")} className="h-11" /></Field>
          <Button type="submit" disabled={saving || !form.name.trim()} className="min-h-11 w-full">{saving ? "Creating…" : "Create project"}</Button>
        </form>
    </FormSheet>
  );
}
