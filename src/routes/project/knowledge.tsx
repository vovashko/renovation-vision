import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { Field, FormSheet, VisibleSwitch } from "@/components/manager/form-sheet";
import { PageHeader, PageLoading } from "@/components/page-header";
import { VisibilityBadge } from "@/components/manager/visibility-badge";
import { api, type KnowledgeInput } from "@/lib/api";
import { keys, useKnowledge, useSave } from "@/lib/queries";
import type { Knowledge } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/knowledge")({
  head: () => ({
    meta: [
      { title: "AI knowledge — RenoVision" },
      { name: "description", content: "Facts the client's AI assistant can use when answering questions." },
    ],
  }),
  component: KnowledgePage,
});

function KnowledgePage() {
  const { projectId } = Route.useParams();
  const { data: entries, isLoading } = useKnowledge(projectId);
  const [editing, setEditing] = useState<Knowledge | "new" | null>(null);
  const toggle = useSave(projectId, (k: Knowledge) => api.saveKnowledge(projectId, { id: k.id, is_visible: !k.is_visible }), {
    invalidate: [keys.knowledge(projectId)],
    success: (k) => (k.is_visible ? "The assistant will no longer use this" : "The assistant can use this now"),
  });
  if (isLoading || !entries) return <PageLoading />;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="AI knowledge"
        description="The client's “Ask AI” assistant answers from project data plus the visible entries here."
        actions={
          <Button onClick={() => setEditing("new")} className="min-h-11 gap-2">
            <Plus className="h-4 w-4" /> Add entry
          </Button>
        }
      />
      {entries.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={BookOpen}
          title="Nothing yet"
          text="Add answers to the questions clients ask most — working hours, deliveries, why something is blocked."
        />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {entries.map((k) => (
            <article
              key={k.id}
              className={`rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)] ${k.is_visible ? "" : "border-dashed"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">{k.title}</h2>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setEditing(k)}
                  aria-label={`Edit ${k.title}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{k.content}</p>
              {k.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {k.tags.map((t) => (
                    <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between gap-2">
                <VisibilityBadge visible={k.is_visible} hiddenLabel="Internal only" />
                <Switch checked={k.is_visible} onCheckedChange={() => toggle.mutate(k)} aria-label={`Let the assistant use ${k.title}`} />
              </div>
            </article>
          ))}
        </div>
      )}
      <KnowledgeSheet projectId={projectId} entry={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function KnowledgeSheet({ projectId, entry, onClose }: { projectId: string; entry: Knowledge | "new" | null; onClose: () => void }) {
  const isNew = entry === "new";
  const [form, setForm] = useState<{ title: string; content: string; tags: string; is_visible: boolean } | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = entry === null ? null : isNew ? "new" : entry.id;
  if (key !== lastKey) {
    setLastKey(key);
    setForm(
      entry === null
        ? null
        : isNew
          ? { title: "", content: "", tags: "", is_visible: true }
          : { title: entry.title, content: entry.content, tags: entry.tags.join(", "), is_visible: entry.is_visible },
    );
  }
  const inv = { invalidate: [keys.knowledge(projectId)] };
  const save = useSave(projectId, (k: KnowledgeInput) => api.saveKnowledge(projectId, k), { ...inv, success: "Saved" });
  const remove = useSave(projectId, (id: string) => api.deleteKnowledge(id), { ...inv, success: "Deleted" });

  return (
    <FormSheet
      open={entry !== null}
      onOpenChange={(v) => !v && onClose()}
      title={isNew ? "Add knowledge" : "Edit knowledge"}
      description="Write it the way you'd explain it to the client."
    >
      {form && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              {
                ...(isNew ? {} : { id: (entry as Knowledge).id }),
                title: form.title.trim(),
                content: form.content.trim(),
                is_visible: form.is_visible,
                tags: form.tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              },
              { onSuccess: onClose },
            );
          }}
        >
          <Field id="kn-title" label="Topic or question">
            <Input
              id="kn-title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="h-11"
            />
          </Field>
          <Field id="kn-content" label="Answer">
            <Textarea
              id="kn-content"
              required
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="min-h-32"
            />
          </Field>
          <Field id="kn-tags" label="Tags" hint="Comma separated, e.g. kitchen, delivery">
            <Input id="kn-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="h-11" />
          </Field>
          <VisibleSwitch
            id="kn-visible"
            checked={form.is_visible}
            onChange={(v) => setForm({ ...form, is_visible: v })}
            label="Assistant may use this with the client"
          />
          <Button type="submit" disabled={save.isPending || !form.title.trim()} className="min-h-11 w-full">
            Save
          </Button>
          {!isNew && entry && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full gap-2 text-destructive"
              onClick={() => confirm("Delete this entry?") && remove.mutate(entry.id, { onSuccess: onClose })}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
        </form>
      )}
    </FormSheet>
  );
}
