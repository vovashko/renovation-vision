// Address-book hooks (`/contacts`, staff only): the list, a contact's project links, and the writes.
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import type { Contact, ProjectContactRole } from "@/lib/database.types";
import { peopleRepo, type ContactFields, type ContactLink } from "../data/people.repo";
import { filterContacts, NO_FILTERS, tradesOf, type ContactFilters } from "../domain/contact-book";
import { toContactFields } from "../domain/contacts";
import type { ContactFormValues } from "../domain/schemas";
import { usePeopleErrorText } from "./errors";

export type { ContactLink } from "../data/people.repo";

export const useContacts = () => useQuery({ queryKey: keys.contacts, queryFn: () => peopleRepo.listContacts() });

/** The projects one contact is on (enabled once a contact is open). */
export const useContactLinks = (contactId: string | undefined) =>
  useQuery({ queryKey: keys.contactLinks(contactId ?? ""), queryFn: () => peopleRepo.listContactLinks(contactId!), enabled: !!contactId });

/** Every project a contact is on (also the ones the caller can't see) and the ones they manage: the delete guard. */
export const useContactLinkSummary = (contactId: string | undefined) =>
  useQuery({
    queryKey: keys.contactLinkSummary(contactId ?? ""),
    queryFn: () => peopleRepo.contactLinkSummary(contactId!),
    enabled: !!contactId,
  });

/** Search text, kind and trade filters over the loaded book, with the matching contacts and the trade options. */
export function useContactFilters(contacts: Contact[]) {
  const [filters, setFilters] = useState<ContactFilters>(NO_FILTERS);
  const visible = useMemo(() => filterContacts(contacts, filters), [contacts, filters]);
  const trades = useMemo(() => tradesOf(contacts), [contacts]);
  const patch = useCallback((next: Partial<ContactFilters>) => setFilters((f) => ({ ...f, ...next })), []);
  const clear = useCallback(() => setFilters(NO_FILTERS), []);
  return { filters, patch, clear, visible, trades };
}

/** Form values → `contacts` columns: blank optional fields become null. */
export function contactFieldsOf(values: ContactFormValues): ContactFields & { full_name: string } {
  const { full_name, kind, ...rest } = values;
  return { ...toContactFields(rest), kind, full_name };
}

export function useSaveContact() {
  const { t } = useTranslation(["people"]);
  const errorText = usePeopleErrorText();
  return useMutationWithToast(
    async ({ id, values }: { id?: string; values: ContactFormValues }) => {
      if (id) await peopleRepo.updateContact(id, contactFieldsOf(values));
      else await peopleRepo.createContact(contactFieldsOf(values));
    },
    {
      // A contact's name and details show on every project's lists and on the client's contact card.
      invalidate: [keys.contacts, ["projectContacts"], ["visibleContacts"], keys.projects],
      success: ({ values }) => t("contacts.saved", { name: values.full_name }),
      error: errorText,
    },
  );
}

export function useDeleteContact() {
  const { t } = useTranslation(["people"]);
  const errorText = usePeopleErrorText();
  return useMutationWithToast((contact: Contact) => peopleRepo.deleteContact(contact.id), {
    invalidate: [keys.contacts],
    success: (contact) => t("contacts.deleted", { name: contact.full_name }),
    error: errorText,
  });
}

/** Puts a contact on a project in a role other than client. */
export function useAssignContact(contactId: string) {
  const { t } = useTranslation(["people"]);
  const errorText = usePeopleErrorText();
  return useMutationWithToast(
    (vars: { projectId: string; role: Exclude<ProjectContactRole, "client">; visibleToClient: boolean }) =>
      peopleRepo.assignContact(contactId, vars),
    {
      invalidate: (vars) => [
        keys.contactLinks(contactId),
        keys.contactLinkSummary(contactId),
        keys.projectContacts(vars.projectId),
        keys.visibleContacts(vars.projectId),
        keys.activity(vars.projectId),
      ],
      success: t("contacts.assigned"),
      error: errorText,
    },
  );
}

/** Takes a contact off one project (the address-book entry stays). */
export function useUnassignContact(contactId: string) {
  const { t } = useTranslation(["people"]);
  return useMutationWithToast((link: ContactLink) => peopleRepo.unlinkProjectContact(link.id), {
    invalidate: (link) => [
      keys.contactLinks(contactId),
      keys.contactLinkSummary(contactId),
      keys.projectContacts(link.project_id),
      keys.visibleContacts(link.project_id),
      keys.activity(link.project_id),
    ],
    success: t("contacts.unassigned"),
  });
}

/** Shows or hides a project contact on the client's "Your contact" card. */
export function useSetLinkVisible(contactId: string) {
  return useMutationWithToast((vars: { link: ContactLink; visible: boolean }) => peopleRepo.setLinkVisible(vars.link.id, vars.visible), {
    invalidate: ({ link }) => [
      keys.contactLinks(contactId),
      keys.contactLinkSummary(contactId),
      keys.projectContacts(link.project_id),
      keys.visibleContacts(link.project_id),
    ],
  });
}
