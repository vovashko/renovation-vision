import { useTranslation } from "react-i18next";
import type { Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Note } from "@/components/ui/note";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/shared/ui/form-field";
import { FormSheet } from "@/shared/ui/form-sheet";
import { useConfirm } from "@/shared/ui/use-confirm";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import type { Contact } from "@/lib/database.types";
import { CONTACT_KINDS, deleteBlockedBy } from "../domain/contact-book";
import { contactFormSchema, emptyContact, type ContactFormValues } from "../domain/schemas";
import { useContactLinkSummary, useDeleteContact, useSaveContact } from "../hooks/contacts";
import { ContactProjects } from "./contact-projects";

function contactToForm(c: Contact): ContactFormValues {
  return {
    full_name: c.full_name,
    kind: c.kind,
    company: c.company ?? "",
    trade: c.trade ?? "",
    phone: c.phone ?? "",
    whatsapp: c.whatsapp ?? "",
    email: c.email ?? "",
    notes: c.notes ?? "",
  };
}

function ContactFormFields({ control }: { control: Control<ContactFormValues, unknown, ContactFormValues> }) {
  const { t } = useTranslation(["people"]);
  return (
    <>
      <FormField control={control} name="full_name" label={t("contacts.name")}>
        {(field) => <Input autoComplete="off" {...field} />}
      </FormField>
      <FormField control={control} name="kind" label={t("contacts.kindLabel")}>
        {(field) => (
          <NativeSelect {...field}>
            {CONTACT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`contacts.kind.${kind}`)}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField control={control} name="company" label={t("contacts.company")}>
          {(field) => <Input autoComplete="off" {...field} />}
        </FormField>
        <FormField control={control} name="trade" label={t("contacts.trade")}>
          {(field) => <Input autoComplete="off" placeholder={t("crew.tradePlaceholder")} {...field} />}
        </FormField>
        <FormField control={control} name="phone" label={t("contacts.phone")}>
          {(field) => <Input type="tel" autoComplete="off" {...field} />}
        </FormField>
        <FormField control={control} name="whatsapp" label={t("contacts.whatsapp")} description={t("contacts.whatsappHint")}>
          {(field) => <Input type="tel" autoComplete="off" placeholder="+48600100200" {...field} />}
        </FormField>
      </div>
      <FormField control={control} name="email" label={t("contacts.email")}>
        {(field) => <Input type="email" autoComplete="off" {...field} />}
      </FormField>
      <FormField control={control} name="notes" label={t("contacts.notes")}>
        {(field) => <Textarea rows={3} {...field} />}
      </FormField>
    </>
  );
}

/** Delete button that refuses, and says which projects to leave first, while the contact is on a project. */
export function DeleteContact({ contact, onDeleted }: { contact: Contact; onDeleted: () => void }) {
  const { t } = useTranslation(["people"]);
  const confirm = useConfirm();
  const remove = useDeleteContact();
  const { data: summary, isLoading } = useContactLinkSummary(contact.id);
  const guard = deleteBlockedBy(summary ?? { total: 0, managed: [] });
  return (
    <div className="space-y-2">
      {guard.blocked && (
        <Note size="sm" role="status">
          <p>{t("contacts.deleteBlocked", { count: guard.total, managed: guard.managed.length })}</p>
          {guard.managed.length > 0 && (
            <p className="mt-1">{t("contacts.deleteBlockedProjects", { projects: guard.managed.join(", ") })}</p>
          )}
        </Note>
      )}
      <Button
        type="button"
        variant="destructive"
        className="w-full"
        disabled={isLoading || guard.blocked || remove.isPending}
        onClick={async () => {
          const ok = await confirm({
            title: t("contacts.deleteConfirmTitle", { name: contact.full_name }),
            description: t("contacts.deleteConfirmDescription"),
            confirmLabel: t("contacts.delete"),
            destructive: true,
          });
          if (ok) remove.mutate(contact, { onSuccess: onDeleted });
        }}
      >
        {t("contacts.delete")}
      </Button>
    </div>
  );
}

/** The form and, when editing, the contact's projects and the delete button. Mounted fresh each time the sheet opens. */
function ContactEditor({ contact, onClose }: { contact: Contact | null; onClose: () => void }) {
  const { t } = useTranslation(["people", "common"]);
  const save = useSaveContact();
  const form = useZodForm(contactFormSchema, contact ? contactToForm(contact) : emptyContact);
  return (
    <div className="space-y-6">
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values: ContactFormValues) => save.mutate({ id: contact?.id, values }, { onSuccess: onClose }))}
      >
        <ContactFormFields control={form.control} />
        <Button type="submit" loading={save.isPending} className="w-full">
          {save.isPending ? t("common:state.saving") : contact ? t("contacts.save") : t("contacts.add")}
        </Button>
      </form>
      {contact && (
        <>
          <ContactProjects contact={contact} />
          <DeleteContact contact={contact} onDeleted={onClose} />
        </>
      )}
    </div>
  );
}

/** Add (`contact` null) or edit a contact. */
export function ContactSheet({ contact, open, onClose }: { contact: Contact | null; open: boolean; onClose: () => void }) {
  const { t } = useTranslation(["people"]);
  return (
    <FormSheet
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={contact ? t("contacts.editTitle") : t("contacts.addTitle")}
      description={t("contacts.sheetDescription")}
    >
      <ContactEditor key={contact?.id ?? "new"} contact={contact} onClose={onClose} />
    </FormSheet>
  );
}
