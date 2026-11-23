import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { PageHeader, PageLoading } from "@/components/page-header";
import { ContactsImportButton } from "@/features/import/ui/import-button";
import type { Contact } from "@/lib/database.types";
import { hasFilters } from "../domain/contact-book";
import { useContactFilters, useContacts } from "../hooks/contacts";
import { ContactSheet } from "./contact-sheet";
import { ContactFilterBar } from "./contacts-filters";
import { ContactRows } from "./contacts-row";

/** The address book (`/contacts`, staff only): search and filter, add, edit, delete, assign to projects, import. */
export function ContactsPage() {
  const { t } = useTranslation(["people"]);
  const { data: contacts, isLoading, isError } = useContacts();
  const { filters, patch, clear, visible, trades } = useContactFilters(contacts ?? []);
  // `undefined`: closed, `null`: adding, a contact: editing it.
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined);

  if (isLoading) return <PageLoading />;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title={t("contacts.pageTitle")}
        description={t("contacts.pageDescription")}
        actions={
          <>
            <ContactsImportButton />
            <Button onClick={() => setEditing(null)} className="min-h-11 gap-2">
              <Icon name="person_add" size={20} /> {t("contacts.add")}
            </Button>
          </>
        }
      />

      {isError ? (
        <p role="alert" className="text-body-md text-error">
          {t("contacts.loadError")}
        </p>
      ) : (
        <>
          <ContactFilterBar filters={filters} trades={trades} onChange={patch} />
          <p className="text-body-sm text-on-surface-variant" role="status">
            {t("contacts.count", { shown: visible.length, count: contacts?.length ?? 0 })}
          </p>
          {visible.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon" icon="contacts" />
                <EmptyDescription>{hasFilters(filters) ? t("contacts.noMatches") : t("contacts.empty")}</EmptyDescription>
              </EmptyHeader>
              {hasFilters(filters) && (
                <Button variant="outline" onClick={clear}>
                  {t("contacts.clearFilters")}
                </Button>
              )}
            </Empty>
          ) : (
            <ContactRows contacts={visible} onEdit={setEditing} />
          )}
        </>
      )}

      <ContactSheet contact={editing ?? null} open={editing !== undefined} onClose={() => setEditing(undefined)} />
    </div>
  );
}
