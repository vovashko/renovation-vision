import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";

function SettingsLink({
  to,
  icon,
  title,
  description,
}: {
  to: "/settings/profile" | "/settings/security";
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Item asChild size="lg">
      <Link to={to}>
        <ItemMedia variant="icon" icon={icon} />
        <ItemContent>
          <ItemTitle>{title}</ItemTitle>
          <ItemDescription>{description}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Icon name="chevron_right" size={20} />
        </ItemActions>
      </Link>
    </Item>
  );
}

/** /settings: the two settings pages. */
export function SettingsNav({ className }: { className?: string }) {
  const { t } = useTranslation(["settings"]);
  return (
    <ItemGroup className={className}>
      <SettingsLink to="/settings/profile" icon="person" title={t("profile.title")} description={t("profile.summary")} />
      <SettingsLink to="/settings/security" icon="shield_lock" title={t("security.title")} description={t("security.summary")} />
    </ItemGroup>
  );
}

/** "← Settings" above a settings sub-page. */
export function SettingsBackLink() {
  const { t } = useTranslation(["settings"]);
  return (
    <Button asChild variant="ghost" size="sm">
      <Link to="/settings">
        <Icon name="arrow_back" size={20} />
        {t("title")}
      </Link>
    </Button>
  );
}
