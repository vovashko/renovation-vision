import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { NativeSelect } from "@/components/ui/native-select";
import { Note } from "@/components/ui/note";
import { Switch } from "@/components/ui/switch";
import { useProjects } from "@/features/projects/hooks";
import type { Contact } from "@/lib/database.types";
import type { ContactLink } from "../data/people.repo";
import {
  ASSIGNABLE_ROLES,
  defaultRoleFor,
  freeRoles,
  isAssignableRole,
  visibleByDefault,
  type AssignableRole,
} from "../domain/contact-book";
import { useAssignContact, useContactLinks, useSetLinkVisible, useUnassignContact } from "../hooks/contacts";

/** One project the contact is on: its role there, whether the client sees them, and a remove button. */
function ProjectLinkRow({ contact, link }: { contact: Contact; link: ContactLink }) {
  const { t } = useTranslation(["people"]);
  const unassign = useUnassignContact(contact.id);
  const setVisible = useSetLinkVisible(contact.id);
  const project = link.project?.name ?? t("contacts.unknownProject");
  const isClient = link.role === "client";
  return (
    <Item variant="plain" size="default">
      <ItemContent>
        <ItemTitle className="truncate">{project}</ItemTitle>
        <ItemDescription>{isClient ? t("contacts.clientLink") : t(`contacts.role.${link.role as AssignableRole}`)}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {/* The client card owns the client link: it can be neither shown, hidden nor removed from here. */}
        {isClient ? (
          <Badge variant="outline" size="compact">
            {t("contacts.kind.client")}
          </Badge>
        ) : (
          <>
            <Switch
              checked={link.visible_to_client}
              disabled={setVisible.isPending}
              onCheckedChange={(visible) => setVisible.mutate({ link, visible })}
              aria-label={t("contacts.visibleAria", { project })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={unassign.isPending}
              onClick={() => unassign.mutate(link)}
              aria-label={t("contacts.unassignAria", { project })}
            >
              <Icon name="close" size={22} />
            </Button>
          </>
        )}
      </ItemActions>
    </Item>
  );
}

/**
 * The "add to a project" form of a contact: a project, a role (point of contact, crew, supplier or architect, never
 * client) and whether the client sees them. The `client` role belongs to the client card on the project overview.
 */
export function AssignContactForm({ contact, links }: { contact: Contact; links: ContactLink[] }) {
  const { t } = useTranslation(["people"]);
  const id = useId();
  const { data: projects = [] } = useProjects();
  const assign = useAssignContact(contact.id);
  const [projectId, setProjectId] = useState("");
  const [role, setRole] = useState<AssignableRole>(defaultRoleFor(contact.kind));
  const [visible, setVisible] = useState(visibleByDefault(defaultRoleFor(contact.kind)));

  const roles = projectId ? freeRoles(links, projectId) : [...ASSIGNABLE_ROLES];
  const effectiveRole = roles.includes(role) ? role : roles[0];
  const changeRole = (next: string) => {
    if (!isAssignableRole(next)) return;
    setRole(next);
    setVisible(visibleByDefault(next));
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!projectId || !effectiveRole) return;
        assign.mutate({ projectId, role: effectiveRole, visibleToClient: visible }, { onSuccess: () => setProjectId("") });
      }}
    >
      <Field>
        <FieldLabel htmlFor={`${id}-project`}>{t("contacts.project")}</FieldLabel>
        <NativeSelect id={`${id}-project`} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">{t("contacts.chooseProject")}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {projectId && roles.length === 0 ? (
        <Note size="sm">{t("contacts.allRolesTaken")}</Note>
      ) : (
        <>
          <Field>
            <FieldLabel htmlFor={`${id}-role`}>{t("contacts.roleLabel")}</FieldLabel>
            <NativeSelect id={`${id}-role`} value={effectiveRole} onChange={(e) => changeRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {t(`contacts.role.${r}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <label htmlFor={`${id}-visible`} className="text-body-md">
              {t("contacts.visibleToClient")}
            </label>
            <Switch id={`${id}-visible`} checked={visible} onCheckedChange={setVisible} />
          </div>
        </>
      )}
      <p className="text-body-sm text-on-surface-variant">{t("contacts.clientRoleNote")}</p>
      <Button type="submit" variant="outline" loading={assign.isPending} disabled={!projectId || !effectiveRole} className="w-full">
        {t("contacts.assign")}
      </Button>
    </form>
  );
}

/** The projects a contact is on, and the form to add them to another. */
export function ContactProjects({ contact }: { contact: Contact }) {
  const { t } = useTranslation(["people"]);
  const { data: links = [], isLoading } = useContactLinks(contact.id);
  return (
    <section className="space-y-3" aria-labelledby="contact-projects-heading">
      <h3 id="contact-projects-heading" className="text-title-md">
        {t("contacts.projectsHeading")}
      </h3>
      {!isLoading && links.length === 0 && <p className="text-body-md text-on-surface-variant">{t("contacts.noProjects")}</p>}
      {links.length > 0 && (
        <ItemGroup>
          {links.map((link) => (
            <ProjectLinkRow key={link.id} contact={contact} link={link} />
          ))}
        </ItemGroup>
      )}
      <AssignContactForm contact={contact} links={links} />
    </section>
  );
}
