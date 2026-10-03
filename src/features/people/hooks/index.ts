import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import type { Member, ProjectContact, ProjectRole } from "@/lib/database.types";
import { peopleRepo } from "../data/people.repo";
import { nextSortOrder, toContactFields } from "../domain/contacts";
import type { ClientContactValues, CrewFormValues } from "../domain/schemas";

export const useMembers = (projectId: string) =>
  useQuery({ queryKey: keys.members(projectId), queryFn: () => peopleRepo.listMembers(projectId) });

/** Every contact on the project (crew, client, PoC…): managers only. */
export const useProjectContacts = (projectId: string) =>
  useQuery({ queryKey: keys.projectContacts(projectId), queryFn: () => peopleRepo.listProjectContacts(projectId) });

/** The project's client-visible contacts (the PoC): any member. */
export const useVisibleContacts = (projectId: string) =>
  useQuery({ queryKey: keys.visibleContacts(projectId), queryFn: () => peopleRepo.listVisibleContacts(projectId) });

/** Contact edits show up in the manager's lists, the client's "Your contact" card and the client name on the project. */
const contactKeys = (projectId: string) => [
  keys.projectContacts(projectId),
  keys.visibleContacts(projectId),
  keys.project(projectId),
  keys.projects,
];

export function useAddMember(projectId: string) {
  const { t } = useTranslation(["people"]);
  return useMutationWithToast((vars: { email: string; role: ProjectRole }) => peopleRepo.addMember(projectId, vars.email, vars.role), {
    invalidate: [keys.members(projectId)],
    success: (vars) => t("team.added", { email: vars.email }),
  });
}

export function useRemoveMember(projectId: string) {
  const { t } = useTranslation(["people"]);
  return useMutationWithToast((member: Member) => peopleRepo.removeMember(projectId, member.user_id), {
    invalidate: [keys.members(projectId)],
    success: (member) => t("team.removed", { name: member.profile.full_name }),
  });
}

/** Adds a crew member: a new address-book contact (kind crew), linked to the project after the others. */
export function useAddCrew(projectId: string, links: ProjectContact[]) {
  const { t } = useTranslation(["people"]);
  return useMutationWithToast(
    (values: CrewFormValues) =>
      peopleRepo.addProjectContact(projectId, {
        kind: "crew",
        role: "crew",
        fields: { ...toContactFields(values), full_name: values.full_name },
        sortOrder: nextSortOrder(links, "crew"),
      }),
    { invalidate: contactKeys(projectId), success: (values) => t("crew.saved", { name: values.full_name }) },
  );
}

/** Edits a crew member's address-book entry. */
export function useUpdateCrew(projectId: string) {
  const { t } = useTranslation(["people"]);
  return useMutationWithToast(
    ({ link, values }: { link: ProjectContact; values: CrewFormValues }) =>
      peopleRepo.updateContact(link.contact_id, { ...toContactFields(values), full_name: values.full_name }),
    { invalidate: contactKeys(projectId), success: ({ values }) => t("crew.saved", { name: values.full_name }) },
  );
}

/** Takes a crew member off the project; they stay in the address book. */
export function useRemoveCrew(projectId: string) {
  const { t } = useTranslation(["people"]);
  return useMutationWithToast((link: ProjectContact) => peopleRepo.unlinkProjectContact(link.id), {
    invalidate: contactKeys(projectId),
    success: (link) => t("crew.removed", { name: link.contact.full_name }),
  });
}

/** Saves the client card: edits the primary client contact, or creates and links one when there is none. */
export function useSaveClientContact(projectId: string, client: ProjectContact | undefined) {
  const { t } = useTranslation(["people"]);
  return useMutationWithToast(
    (values: ClientContactValues) => {
      const fields = { ...toContactFields(values), full_name: values.full_name };
      return client
        ? peopleRepo.updateContact(client.contact_id, fields)
        : peopleRepo.addProjectContact(projectId, { kind: "client", role: "client", fields, isPrimary: true });
    },
    { invalidate: contactKeys(projectId), success: t("clientContact.saved") },
  );
}
