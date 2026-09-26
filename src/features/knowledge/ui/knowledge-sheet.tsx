import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FormSheet, VisibleSwitch } from "@/components/manager/form-sheet";
import { api, type KnowledgeInput } from "@/lib/api";
import { keys, useSave } from "@/lib/queries";
import type { Knowledge } from "@/lib/database.types";

export function KnowledgeSheet({ projectId, entry, onClose }: { projectId: string; entry: Knowledge | "new" | null; onClose: () => void }) {
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
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="kn-title">Topic or question</FieldLabel>
              <Input id="kn-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="kn-content">Answer</FieldLabel>
              <Textarea
                id="kn-content"
                required
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="min-h-32"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="kn-tags">Tags</FieldLabel>
              <Input id="kn-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              <FieldDescription>Comma separated, e.g. kitchen, delivery</FieldDescription>
            </Field>
            <VisibleSwitch
              id="kn-visible"
              checked={form.is_visible}
              onChange={(v) => setForm({ ...form, is_visible: v })}
              label="Assistant may use this with the client"
            />
            <Button type="submit" disabled={save.isPending || !form.title.trim()} className="w-full">
              Save
            </Button>
            {!isNew && entry && (
              <Button
                type="button"
                variant="ghost"
                className="w-full gap-2 text-destructive"
                onClick={() => confirm("Delete this entry?") && remove.mutate(entry.id, { onSuccess: onClose })}
              >
                <Icon name="delete" size={20} /> Delete
              </Button>
            )}
          </FieldGroup>
        </form>
      )}
    </FormSheet>
  );
}
