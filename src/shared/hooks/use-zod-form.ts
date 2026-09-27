import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues, type UseFormProps } from "react-hook-form";
import type { z } from "zod";

/**
 * react-hook-form wired to a zod schema: `useZodForm(schema, defaults)`. Submit handlers receive
 * the schema's parsed output. Validation runs on blur, then on every change once a field is invalid.
 *
 * Validation messages are i18n keys, e.g. `z.string().min(1, "common:form.required")`;
 * `<FormField>` translates them (a message that isn't a key is shown as is).
 */
export function useZodForm<S extends z.ZodTypeAny>(
  schema: S,
  defaultValues: DefaultValues<z.input<S>>,
  options: Omit<UseFormProps<z.input<S>, unknown, z.output<S>>, "resolver" | "defaultValues"> = {},
) {
  return useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onTouched",
    ...options,
  });
}
