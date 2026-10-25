import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/shared/ui/form-field";
import { FormSheet } from "@/shared/ui/form-sheet";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import type { ChangeRequest } from "@/lib/database.types";
import { CHANGE_KINDS, changeRequestSchema, kindOf, type ChangeKind, type ChangeRequestFormInput } from "../domain/schemas";
import { useCreateChangeRequest, useUpdateChangeRequest } from "../hooks";

function defaultsFor(request: ChangeRequest | "new", kind: ChangeKind): ChangeRequestFormInput {
  if (request === "new") return { kind, title: "", description: "", cost_delta: null, days_delta: "", stage_id: "" };
  return {
    kind: kindOf(request),
    title: request.title,
    description: request.description,
    cost_delta: request.cost_delta === 0 ? null : request.cost_delta,
    days_delta: request.days_delta === 0 ? "" : String(request.days_delta),
    stage_id: request.stage_id ?? "",
  };
}

const KIND_LABEL = { cost: "kindCost", days: "kindDays", both: "kindBoth" } as const;

/**
 * Create or edit a change request (managers). "What changes?" is pre-chosen by the page it is opened from (cost
 * in Budget, schedule in Progress) and decides which of the two fields show; the hidden one counts as 0.
 */
export function ChangeRequestFormSheet({
  projectId,
  request,
  defaultKind,
  currency,
  stages,
  onClose,
}: {
  projectId: string;
  /** `"new"` to create, a request to edit, null when closed. */
  request: ChangeRequest | "new" | null;
  defaultKind: ChangeKind;
  currency: string;
  stages: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { t } = useTranslation(["change-requests", "common"]);
  const isNew = request === "new";
  const key = request === null ? null : isNew ? "new" : request.id;
  const form = useZodForm(changeRequestSchema, defaultsFor(request ?? "new", defaultKind));
  const create = useCreateChangeRequest(projectId);
  const update = useUpdateChangeRequest(projectId);

  useEffect(() => {
    if (request !== null) form.reset(defaultsFor(request, defaultKind));
    // Re-run only when the sheet targets a different request (or opens/closes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const kind = form.watch("kind");
  const pending = create.isPending || update.isPending;

  const onSubmit = form.handleSubmit((values) => {
    const input = {
      title: values.title,
      description: values.description,
      cost_delta: values.cost_delta,
      days_delta: values.days_delta,
      stage_id: values.stage_id,
    };
    if (request === "new" || request === null) create.mutate(input, { onSuccess: onClose });
    else update.mutate({ request, input }, { onSuccess: onClose });
  });

  return (
    <FormSheet
      open={request !== null}
      onOpenChange={(open) => !open && onClose()}
      title={isNew ? t("change-requests:form.newTitle") : t("change-requests:form.editTitle")}
      description={t("change-requests:form.description")}
    >
      {request !== null && (
        <form noValidate onSubmit={onSubmit}>
          <FieldGroup>
            <FormField control={form.control} name="kind" label={t("change-requests:form.kind")}>
              {(field) => (
                <SegmentedControl role="radiogroup" aria-label={t("change-requests:form.kind")} id={field.id}>
                  {CHANGE_KINDS.map((k) => (
                    <SegmentedControlItem
                      key={k}
                      role="radio"
                      aria-checked={field.value === k}
                      active={field.value === k}
                      onClick={() => field.onChange(k)}
                    >
                      {t(`change-requests:form.${KIND_LABEL[k]}`)}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              )}
            </FormField>
            <FormField control={form.control} name="title" label={t("change-requests:form.title")}>
              {(field) => <Input {...field} placeholder={t("change-requests:form.titlePlaceholder")} />}
            </FormField>
            <FormField control={form.control} name="description" label={t("change-requests:form.descriptionLabel")}>
              {(field) => <Textarea {...field} rows={4} placeholder={t("change-requests:form.descriptionPlaceholder")} />}
            </FormField>
            {kind !== "days" && (
              <FormField
                control={form.control}
                name="cost_delta"
                label={t("change-requests:form.cost")}
                description={t("change-requests:form.costHint")}
              >
                {(field) => <MoneyInput {...field} currency={currency} allowNegative placeholder="0" />}
              </FormField>
            )}
            {kind !== "cost" && (
              <FormField
                control={form.control}
                name="days_delta"
                label={t("change-requests:form.days")}
                description={t("change-requests:form.daysHint")}
              >
                {(field) => <Input {...field} inputMode="numeric" placeholder="0" />}
              </FormField>
            )}
            <FormField
              control={form.control}
              name="stage_id"
              label={t("change-requests:form.stage")}
              description={t("change-requests:form.stageHint")}
            >
              {(field) => (
                <NativeSelect {...field}>
                  <NativeSelectOption value="">{t("change-requests:form.stageNone")}</NativeSelectOption>
                  {stages.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {s.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? t("change-requests:form.submitting") : isNew ? t("change-requests:form.submit") : t("change-requests:form.save")}
            </Button>
          </FieldGroup>
        </form>
      )}
    </FormSheet>
  );
}
