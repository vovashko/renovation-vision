import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { FormSheet } from "@/shared/ui/form-sheet";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import type { ProjectContact } from "@/lib/database.types";
import { addManagerSchema, crewFormSchema, emptyCrew, type AddManagerValues, type CrewFormValues } from "../domain/schemas";
import { useAddCrew } from "../hooks";
import { useAddManager } from "../hooks/invites";
import { CrewFormFields } from "./crew-sheet";
import { InviteManagerPrompt } from "./invite-manager-prompt";

type Kind = "manager" | "crew";

/**
 * The one "Add person" sheet (Team page and overview Team card). A manager gets app access, by email (an email with
 * no account gets an invite instead, T40); crew is a contact only. Clients aren't added here: they come from the
 * client card.
 */
export function AddTeamPersonSheet({
  projectId,
  links,
  open,
  onOpenChange,
}: {
  projectId: string;
  /** All of the project's contacts, to place new crew after the others. */
  links: ProjectContact[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation(["people", "common"]);
  const labelId = useId();
  const [kind, setKind] = useState<Kind>("manager");
  const addManager = useAddManager(projectId);
  // The email "Add manager" found no account for: offer an invite until the email changes.
  const [noAccount, setNoAccount] = useState<string | null>(null);
  const addCrew = useAddCrew(projectId, links);
  const managerForm = useZodForm(addManagerSchema, { email: "" });
  const crewForm = useZodForm(crewFormSchema, emptyCrew);

  const close = () => {
    managerForm.reset({ email: "" });
    crewForm.reset(emptyCrew);
    setNoAccount(null);
    onOpenChange(false);
  };
  const kinds: { key: Kind; label: string }[] = [
    { key: "manager", label: t("addPerson.manager") },
    { key: "crew", label: t("addPerson.crew") },
  ];

  return (
    <FormSheet
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(true) : close())}
      title={t("addPerson.title")}
      description={t("addPerson.description")}
    >
      <div className="space-y-4">
        <Field>
          <FieldTitle id={labelId}>{t("addPerson.kind")}</FieldTitle>
          <SegmentedControl role="radiogroup" aria-labelledby={labelId}>
            {kinds.map((k) => (
              <SegmentedControlItem
                key={k.key}
                role="radio"
                aria-checked={kind === k.key}
                active={kind === k.key}
                onClick={() => setKind(k.key)}
              >
                {k.label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </Field>
        {kind === "manager" ? (
          <form
            noValidate
            className="space-y-4"
            onSubmit={managerForm.handleSubmit((values: AddManagerValues) =>
              addManager.mutate(
                { email: values.email },
                { onSuccess: (result) => (result === "added" ? close() : setNoAccount(values.email)) },
              ),
            )}
          >
            <FormField
              control={managerForm.control}
              name="email"
              label={t("addPerson.managerEmail")}
              description={t("addPerson.managerHint")}
            >
              {(field) => (
                <Input
                  type="email"
                  autoComplete="off"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    setNoAccount(null);
                  }}
                />
              )}
            </FormField>
            {noAccount ? (
              <InviteManagerPrompt projectId={projectId} email={noAccount} onSent={close} />
            ) : (
              <Button type="submit" disabled={addManager.isPending} className="w-full">
                {addManager.isPending ? t("common:state.saving") : t("addPerson.submitManager")}
              </Button>
            )}
          </form>
        ) : (
          <form
            noValidate
            className="space-y-4"
            onSubmit={crewForm.handleSubmit((values: CrewFormValues) => addCrew.mutate(values, { onSuccess: close }))}
          >
            <CrewFormFields control={crewForm.control} />
            <FieldDescription>{t("addPerson.crewHint")}</FieldDescription>
            <Button type="submit" disabled={addCrew.isPending} className="w-full">
              {addCrew.isPending ? t("common:state.saving") : t("addPerson.submitCrew")}
            </Button>
          </form>
        )}
      </div>
    </FormSheet>
  );
}
