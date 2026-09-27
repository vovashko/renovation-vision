import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Controller, type Control, type ControllerRenderProps, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

/** What `<FormField>` hands its child: the RHF field plus the ids/ARIA that tie it to the label and error. */
export type FormControlProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = ControllerRenderProps<
  TFieldValues,
  TName
> & {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
};

type FormFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>, TTransformedValues> = {
  control: Control<TFieldValues, unknown, TTransformedValues>;
  name: TName;
  /** Visible label, already translated. */
  label: ReactNode;
  /** Hint under the control. */
  description?: ReactNode;
  orientation?: "vertical" | "horizontal";
  /** Renders the control: spread the props onto it (`{(field) => <Input {...field} />}`). */
  children: (field: FormControlProps<TFieldValues, TName>) => ReactNode;
};

/**
 * One form row on `ui/field`: label, control, hint and the zod error, wired to react-hook-form.
 *
 *   <FormField control={form.control} name="email" label={t("auth:email")}>
 *     {(field) => <Input type="email" {...field} />}
 *   </FormField>
 */
export function FormField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>, TTransformedValues = TFieldValues>({
  control,
  name,
  label,
  description,
  orientation,
  children,
}: FormFieldProps<TFieldValues, TName, TTransformedValues>) {
  const id = useId();
  const translate = useErrorMessage();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const invalid = fieldState.invalid;
        const describedBy = [description && descriptionId, invalid && errorId].filter(Boolean).join(" ") || undefined;
        return (
          <Field orientation={orientation} data-invalid={invalid || undefined}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {children({ ...field, id, "aria-invalid": invalid, "aria-describedby": describedBy })}
            {description && <FieldDescription id={descriptionId}>{description}</FieldDescription>}
            <FieldError id={errorId} errors={[fieldState.error && { message: translate(fieldState.error.message) }]} />
          </Field>
        );
      }}
    />
  );
}

/** zod messages are i18n keys ("common:form.required"); anything else is shown verbatim. */
function useErrorMessage() {
  const { i18n } = useTranslation();
  return (message: string | undefined) => (message && i18n.exists(message) ? String(i18n.t(message as never)) : message);
}
