import { z } from "zod";

/** The "Add person" sheet's manager tab: an existing manager account, by email. Clients are added on the client card. */
export const addManagerSchema = z.object({
  email: z.string().trim().min(1, "common:form.required").email("common:form.invalidEmail"),
});
export type AddManagerValues = z.output<typeof addManagerSchema>;

const optionalEmail = z.union([z.literal(""), z.string().trim().email("common:form.invalidEmail")]);

/** The site crew add/edit sheet: a `contacts` row (kind crew) linked to the project as crew. */
export const crewFormSchema = z.object({
  full_name: z.string().trim().min(1, "common:form.required"),
  trade: z.string().trim(),
  phone: z.string().trim(),
  email: optionalEmail,
});
export type CrewFormValues = z.output<typeof crewFormSchema>;
export const emptyCrew: CrewFormValues = { full_name: "", trade: "", phone: "", email: "" };

/** The manager-only client contact sheet on the overview: the project's primary client contact. */
export const clientContactSchema = z.object({
  full_name: z.string().trim().min(1, "common:form.required"),
  phone: z.string().trim(),
  email: optionalEmail,
});
export type ClientContactValues = z.output<typeof clientContactSchema>;
