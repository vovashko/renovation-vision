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

const E164 = /^\+[1-9][0-9]{6,14}$/;

/** Spaces, dashes, dots and brackets removed ("+48 (600) 100-200" → "+48600100200"). */
export const stripPhoneSeparators = (value: string) => value.replace(/[\s().-]/g, "");

/** The address-book form (`/contacts`): every column of a `contacts` row people edit. Whatsapp must be E.164 (the table's check). */
export const contactFormSchema = z.object({
  full_name: z.string().trim().min(1, "common:form.required").max(160),
  kind: z.enum(["client", "crew", "supplier", "architect", "other"]),
  company: z.string().trim().max(160),
  trade: z.string().trim().max(120),
  phone: z.string().trim().max(40),
  whatsapp: z
    .string()
    .trim()
    .transform(stripPhoneSeparators)
    .refine((v) => v === "" || E164.test(v), "people:contacts.errors.whatsapp"),
  email: optionalEmail,
  notes: z.string().trim().max(2000),
});
export type ContactFormValues = z.output<typeof contactFormSchema>;
export const emptyContact: ContactFormValues = {
  full_name: "",
  kind: "other",
  company: "",
  trade: "",
  phone: "",
  whatsapp: "",
  email: "",
  notes: "",
};

/** The assign-to-project form: a project, a role (never `client`) and whether the client sees this contact. */
export const assignContactSchema = z.object({
  project_id: z.string().min(1, "common:form.required"),
  role: z.enum(["poc", "crew", "supplier", "architect"]),
  visible_to_client: z.boolean(),
});
export type AssignContactValues = z.output<typeof assignContactSchema>;
