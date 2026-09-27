import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemHeader, ItemTitle } from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { VisibilityBadge } from "@/components/manager/visibility-badge";
import { cn } from "@/lib/utils";
import type { Knowledge } from "@/lib/database.types";

/** One AI-knowledge entry: title, answer, tags, and the visible-to-assistant toggle. */
export function KnowledgeEntryItem({ entry, onEdit, onToggle }: { entry: Knowledge; onEdit: () => void; onToggle: () => void }) {
  const { t } = useTranslation("knowledge");
  return (
    <Item size="lg" className={cn(!entry.is_visible && "border-dashed")}>
      <ItemHeader>
        <ItemTitle size="lg">{entry.title}</ItemTitle>
        <ItemActions>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0"
            onClick={onEdit}
            aria-label={t("entry.editAria", { title: entry.title })}
          >
            <Icon name="edit" size={20} />
          </Button>
        </ItemActions>
      </ItemHeader>
      <ItemContent>
        <ItemDescription className="line-clamp-none whitespace-pre-wrap">{entry.content}</ItemDescription>
        {entry.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <Badge key={tag} variant="assist" size="compact">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </ItemContent>
      <ItemFooter>
        <VisibilityBadge visible={entry.is_visible} hiddenLabel={t("entry.hiddenLabel")} />
        <Switch checked={entry.is_visible} onCheckedChange={onToggle} aria-label={t("entry.toggleAria", { title: entry.title })} />
      </ItemFooter>
    </Item>
  );
}
