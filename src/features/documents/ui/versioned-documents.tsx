import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { ItemGroup } from "@/components/ui/item";
import { DocumentItem, type DocumentActions } from "@/features/documents/ui/document-item";
import type { VersionedDocument } from "@/features/documents/domain/documents";

/**
 * Contract / estimate: each document shows its current version, with the older versions below it as history
 * (never deleted). The site manager can upload a new version of any document.
 */
export function VersionedDocuments({
  groups,
  actions,
  onNewVersion,
  now,
}: {
  groups: VersionedDocument[];
  actions: DocumentActions;
  onNewVersion: (group: string) => void;
  now?: Date;
}) {
  const { t } = useTranslation(["documents"]);
  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ group, current, history }) => (
        <section key={group} aria-label={current.title} className="flex flex-col gap-2">
          <ItemGroup>
            <DocumentItem
              doc={current}
              actions={actions}
              now={now}
              versionLabel={
                current.archived_at
                  ? t("item.version", { version: current.version })
                  : t("item.currentVersion", { version: current.version })
              }
            />
          </ItemGroup>
          {actions.isManager && !current.archived_at && (
            <div>
              <Button variant="tonal" size="sm" className="gap-2" onClick={() => onNewVersion(group)}>
                <Icon name="upload_file" size={20} /> {t("actions.newVersion")}
              </Button>
            </div>
          )}
          {history.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Icon name="history" size={20} /> {t("item.history", { count: history.length })}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <ItemGroup>
                  {history.map((doc) => (
                    <DocumentItem
                      key={doc.id}
                      doc={doc}
                      actions={actions}
                      now={now}
                      versionLabel={t("item.version", { version: doc.version })}
                    />
                  ))}
                </ItemGroup>
              </CollapsibleContent>
            </Collapsible>
          )}
        </section>
      ))}
    </div>
  );
}
