import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Note } from "@/components/ui/note";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/shared/ui/form-field";
import { FormSheet } from "@/shared/ui/form-sheet";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import type { Decision } from "@/lib/database.types";
import { decisionSchema, MAX_PHOTOS, type DecisionFormInput } from "../domain/schemas";
import { useCreateDecision, useUpdateDecision } from "../hooks";

function defaultsFor(decision: Decision | "new"): DecisionFormInput {
  if (decision === "new") return { title: "", description: "", cost_delta: "", days_delta: "", files: [] };
  return {
    title: decision.title,
    description: decision.description,
    cost_delta: String(decision.cost_delta),
    days_delta: String(decision.days_delta),
    files: [],
  };
}

/** Create or edit a case (managers). Photos: the case's current ones (removable) plus new files; at least one, at most 10. */
export function DecisionFormSheet({
  projectId,
  decision,
  currency,
  onClose,
}: {
  projectId: string;
  /** `"new"` to create, a case to edit, null when closed. */
  decision: Decision | "new" | null;
  currency: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(["decisions", "common"]);
  const isNew = decision === "new";
  const key = decision === null ? null : isNew ? "new" : decision.id;
  const form = useZodForm(decisionSchema, defaultsFor(decision ?? "new"));
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const create = useCreateDecision(projectId);
  const update = useUpdateDecision(projectId);

  useEffect(() => {
    if (decision !== null) form.reset(defaultsFor(decision));
    setRemoved(new Set());
    // Re-run only when the sheet targets a different case (or opens/closes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const existing = decision && decision !== "new" ? decision.photos : [];
  const files = form.watch("files");
  const photoCount = existing.length - removed.size + files.length;
  const photosOk = photoCount >= 1 && photoCount <= MAX_PHOTOS;
  const pending = create.isPending || update.isPending;

  const toggleRemoved = (id: string) =>
    setRemoved((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const onSubmit = form.handleSubmit((values) => {
    const input = { title: values.title, description: values.description, cost_delta: values.cost_delta, days_delta: values.days_delta };
    if (decision === "new" || decision === null) {
      create.mutate({ ...input, files: values.files }, { onSuccess: onClose });
    } else {
      update.mutate({ decision, input, files: values.files, removePhotoIds: [...removed] }, { onSuccess: onClose });
    }
  });

  return (
    <FormSheet
      open={decision !== null}
      onOpenChange={(open) => !open && onClose()}
      title={isNew ? t("decisions:form.newTitle") : t("decisions:form.editTitle")}
      description={t("decisions:form.description")}
    >
      {decision !== null && (
        <form noValidate onSubmit={onSubmit}>
          <FieldGroup>
            <FormField control={form.control} name="title" label={t("decisions:form.title")}>
              {(field) => <Input {...field} placeholder={t("decisions:form.titlePlaceholder")} />}
            </FormField>
            <FormField control={form.control} name="description" label={t("decisions:form.descriptionLabel")}>
              {(field) => <Textarea {...field} rows={5} placeholder={t("decisions:form.descriptionPlaceholder")} />}
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="cost_delta" label={`${t("decisions:form.cost")} (${currency})`}>
                {(field) => <Input {...field} inputMode="decimal" placeholder="0" />}
              </FormField>
              <FormField control={form.control} name="days_delta" label={t("decisions:form.days")}>
                {(field) => <Input {...field} inputMode="numeric" placeholder="0" />}
              </FormField>
            </div>
            <Note size="sm">
              {t("decisions:form.costHint")} {t("decisions:form.daysHint")}
            </Note>
            <FormField control={form.control} name="files" label={t("decisions:form.photos")} description={t("decisions:form.photosHint")}>
              {(field) => (
                <div className="flex flex-col gap-3">
                  {existing.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {existing.map((photo, index) => (
                        <div key={photo.id} className="relative">
                          <img
                            src={photo.url}
                            alt={t("decisions:detail.openPhoto", { index: index + 1 })}
                            className={`aspect-square w-full rounded-sm object-cover ${removed.has(photo.id) ? "opacity-30" : ""}`}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="scrim"
                            className="absolute top-1 right-1"
                            aria-label={removed.has(photo.id) ? t("decisions:form.undoRemove") : t("decisions:form.removePhoto")}
                            onClick={() => toggleRemoved(photo.id)}
                          >
                            <Icon name={removed.has(photo.id) ? "undo" : "close"} size={18} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <FileInput
                    id={field.id}
                    accept="image/*"
                    multiple
                    aria-invalid={field["aria-invalid"]}
                    aria-describedby={field["aria-describedby"]}
                    onChange={(e) => field.onChange(Array.from(e.target.files ?? []))}
                  />
                  {files.length > 0 && <p className="text-body-sm text-on-surface-variant">{files.map((f) => f.name).join(", ")}</p>}
                  {!photosOk && (
                    <Note tone="error" size="sm">
                      {photoCount < 1 ? t("decisions:form.photosRequired") : t("decisions:form.tooManyPhotos")}
                    </Note>
                  )}
                </div>
              )}
            </FormField>
            <Button type="submit" disabled={pending || !photosOk} className="w-full">
              {pending ? t("decisions:form.submitting") : isNew ? t("decisions:form.submit") : t("decisions:form.save")}
            </Button>
          </FieldGroup>
        </form>
      )}
    </FormSheet>
  );
}
