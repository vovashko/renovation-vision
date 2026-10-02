import { z } from "zod";

/** The Team page's "add by email" form. */
export const memberFormSchema = z.object({
  email: z.string().trim().min(1, "common:form.required").email("common:form.invalidEmail"),
  role: z.enum(["client", "manager"], { message: "common:form.invalid" }),
});
export type MemberFormValues = z.output<typeof memberFormSchema>;

const optionalEmail = z.union([z.literal(""), z.string().trim().email("common:form.invalidEmail")]);

/** The site crew add/edit sheet: a `contacts` row (kind crew) linked to the project as crew. */
export const crewFormSchema = z.object({
  full_name: z.string().trim().min(1, "common:form.required"),
  trade: z.string().trim(),
  phone: z.string().trim(),
  email: optionalEmail,
});
export type CrewFormValues = z.output<typeof crewFormSchema>;

/** The manager-only client contact sheet on the overview: the project's primary client contact. */
export const clientContactSchema = z.object({
  full_name: z.string().trim().min(1, "common:form.required"),
  phone: z.string().trim(),
  email: optionalEmail,
});
export type ClientContactValues = z.output<typeof clientContactSchema>;
