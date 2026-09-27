import { useEffect } from "react";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldGroup } from "@/components/ui/field";
import { FormSheet, VisibleSwitch } from "@/shared/ui/form-sheet";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { useConfirm } from "@/shared/ui/use-confirm";
import { knowledgeEntrySchema, type KnowledgeEntryFormInput } from "@/features/knowledge/domain/schemas";
import { useDeleteKnowledge, useSaveKnowledge } from "@/features/knowledge/hooks/use-knowledge";
import type { Knowledge } from "@/lib/database.types";

const emptyValues: KnowledgeEntryFormInput = { title: "", content: "", tags: "", is_visible: true };

export function KnowledgeSheet({ projectId, entry, onClose }: { projectId: string; entry: Knowledge | "new" | null; onClose: () => void }) {
  const { t } = useTranslation(["knowledge", "common"]);
  const confirm = useConfirm();
  const isNew = entry === "new";
  const form = useZodForm(knowledgeEntrySchema, emptyValues);
  const save = useSaveKnowledge(projectId);
  const remove = useDeleteKnowledge(projectId);

  // Reset the form only when switching which entry is open, not on every refetch of `entries`.
  const key = entry === null ? null : isNew ? "new" : entry.id;
  useEffect(() => {
    if (key === null) return;
    form.reset(
      key === "new"
        ? emptyValues
        : {
            title: (entry as Knowledge).title,
            content: (entry as Knowledge).content,
            tags: (entry as Knowledge).tags.join(", "),
            is_visible: (entry as Knowledge).is_visible,
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const onDelete = async () => {
    if (isNew || entry === null) return;
    const ok = await confirm({ title: t("knowledge:sheet.deleteConfirmTitle"), destructive: true });
    if (ok) remove.mutate(entry.id, { onSuccess: onClose });
  };

  return (
    <FormSheet
      open={entry !== null}
      onOpenChange={(v) => !v && onClose()}
      title={isNew ? t("knowledge:sheet.addTitle") : t("knowledge:sheet.editTitle")}
      description={t("knowledge:sheet.description")}
    >
      {entry !== null && (
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => {
            save.mutate({ ...(isNew ? {} : { id: (entry as Knowledge).id }), ...values }, { onSuccess: onClose });
          })}
        >
          <FieldGroup>
            <FormField control={form.control} name="title" label={t("knowledge:sheet.titleLabel")}>
              {(field) => <Input {...field} />}
            </FormField>
            <FormField control={form.control} name="content" label={t("knowledge:sheet.contentLabel")}>
              {(field) => <Textarea {...field} className="min-h-32" />}
            </FormField>
            <FormField
              control={form.control}
              name="tags"
              label={t("knowledge:sheet.tagsLabel")}
              description={t("knowledge:sheet.tagsHint")}
            >
              {(field) => <Input {...field} />}
            </FormField>
            <Controller
              control={form.control}
              name="is_visible"
              render={({ field }) => (
                <VisibleSwitch id="kn-visible" checked={field.value} onChange={field.onChange} label={t("knowledge:sheet.visibleLabel")} />
              )}
            />
            <Button type="submit" disabled={save.isPending} className="w-full">
              {t("knowledge:sheet.save")}
            </Button>
            {!isNew && (
              <Button type="button" variant="ghost" className="w-full gap-2 text-destructive" onClick={onDelete}>
                <Icon name="delete" size={20} /> {t("knowledge:sheet.delete")}
              </Button>
            )}
          </FieldGroup>
        </form>
      )}
    </FormSheet>
  );
}
