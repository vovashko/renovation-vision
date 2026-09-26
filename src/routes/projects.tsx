import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cardVariants } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Field, FormSheet } from "@/components/manager/form-sheet";
import { PageHeader, PageLoading } from "@/components/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useProjects } from "@/lib/queries";
import { longDate, money, scheduleLabel } from "@/lib/format";
import { budgetSummary } from "@/lib/budget";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [{ title: "Projects — RenoVision" }, { name: "description", content: "All renovation projects you manage." }],
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
        description="Everything you update here appears in the client's RenoVision view."
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Icon name="add" size={20} /> New project
          </Button>
        }
      />
      {isLoading ? (
        <PageLoading />
      ) : !projects?.length ? (
        <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high">
            <Icon name="create_new_folder" size={24} className="text-on-surface-variant" />
          </div>
          <h3 className="mt-3 text-title-md">No projects yet</h3>
          <p className="mt-2 max-w-xs text-body-md text-on-surface-variant">
            Create a project, then invite your client from the Team page.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const budget = budgetSummary(p);
            return (
              <Link
                key={p.id}
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                className={cn(cardVariants({ interactive: true, attention: budget.over }), "block min-w-0 px-5 py-5 md:px-6")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-title-lg">{p.name}</h2>
                    <p className="text-body-md text-on-surface-variant">{p.address}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2 pr-3">
                    {p.schedule_status !== "on_schedule" && (
                      <Badge variant="attention" size="compact" icon="schedule">
                        {scheduleLabel[p.schedule_status]}
                      </Badge>
                    )}
                    {budget.over && (
                      <Badge variant="attention" size="compact" icon="euro">
                        Over budget
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-5 flex items-end justify-between text-body-md">
                  <span className="text-on-surface-variant">{p.current_stage ? `Now: ${p.current_stage}` : "Overall progress"}</span>
                  <span className="text-title-md tabular-nums">{p.overall_progress}%</span>
                </div>
                <Progress value={p.overall_progress} className="mt-2" />
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-on-surface-variant">
                  <span>
                    Client <span className="text-on-surface">{p.client_name || "—"}</span>
                  </span>
                  <span>
                    Target <span className="text-on-surface">{longDate(p.target_date)}</span>
                  </span>
                  <span>
                    Spent{" "}
                    <span className="text-on-surface">
                      {money(p.spent)} / {money(p.budget)}
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
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
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New project"
      description="You become its manager. Add stages, rooms and your client next."
    >
      <form onSubmit={submit} className="space-y-4">
        <Field id="np-name" label="Project name">
          <Input id="np-name" required value={form.name} onChange={set("name")} className="h-11" />
        </Field>
        <Field id="np-address" label="Address">
          <Input id="np-address" value={form.address} onChange={set("address")} className="h-11" />
        </Field>
        <Field id="np-client" label="Client name (as shown in the app)">
          <Input id="np-client" value={form.client_name} onChange={set("client_name")} className="h-11" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="np-start" label="Start">
            <Input id="np-start" type="date" value={form.start_date} onChange={set("start_date")} className="h-11" />
          </Field>
          <Field id="np-target" label="Target">
            <Input id="np-target" type="date" value={form.target_date} onChange={set("target_date")} className="h-11" />
          </Field>
        </div>
        <Field id="np-budget" label="Budget ($)">
          <Input id="np-budget" type="number" min={0} step={100} value={form.budget} onChange={set("budget")} className="h-11" />
        </Field>
        <Button type="submit" disabled={saving || !form.name.trim()} className="w-full">
          {saving ? "Creating…" : "Create project"}
        </Button>
      </form>
    </FormSheet>
  );
}
