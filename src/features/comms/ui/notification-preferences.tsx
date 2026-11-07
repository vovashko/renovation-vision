import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  EMAIL_FREQUENCIES,
  PREFERENCE_GROUPS,
  isEmailFrequency,
  type EmailFrequency,
  type PreferenceGroupKey,
} from "@/features/comms/domain/delivery";

type GroupKey = PreferenceGroupKey | "changeRequests";
// Named at module scope so the linter does not take this i18n key segment for user-facing text.
const CHANGE_REQUESTS: GroupKey = "changeRequests";

function GroupText({ group }: { group: GroupKey }) {
  const { t } = useTranslation("comms");
  return (
    <ItemContent>
      <ItemTitle>{t(`preferences.groups.${group}.title`)}</ItemTitle>
      <ItemDescription>{t(`preferences.groups.${group}.description`)}</ItemDescription>
      <ItemDescription>{t("preferences.inApp")}</ItemDescription>
    </ItemContent>
  );
}

/**
 * One notification group: always in the app, and an email frequency (right away, the 07:00 digest, or off). Shows
 * the effective default (with a "Default" badge) until the user picks one.
 */
export function EmailPreferenceRow({
  group,
  frequency,
  saved,
  disabled,
  onChange,
}: {
  group: PreferenceGroupKey;
  frequency: EmailFrequency;
  saved: boolean;
  disabled?: boolean;
  onChange: (frequency: EmailFrequency) => void;
}) {
  const { t } = useTranslation("comms");
  return (
    <Item size="lg">
      <GroupText group={group} />
      <ItemActions className="w-full sm:w-64">
        <NativeSelect
          size="sm"
          aria-label={t("preferences.emailLabel", { group: t(`preferences.groups.${group}.title`) })}
          value={frequency}
          disabled={disabled}
          onChange={(e) => isEmailFrequency(e.target.value) && onChange(e.target.value)}
        >
          {EMAIL_FREQUENCIES.map((f) => (
            <NativeSelectOption key={f} value={f}>
              {t(`preferences.frequency.${f}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {!saved && (
          <Badge variant="outline" size="compact">
            {t("preferences.default")}
          </Badge>
        )}
      </ItemActions>
    </Item>
  );
}

/** Change requests: always emailed right away, whatever the preferences (not a choice). */
export function AlwaysEmailedRow() {
  const { t } = useTranslation("comms");
  return (
    <Item size="lg">
      <GroupText group={CHANGE_REQUESTS} />
      <ItemActions>
        <Badge variant="outline" size="compact">
          {t("preferences.groups.changeRequests.always")}
        </Badge>
      </ItemActions>
    </Item>
  );
}

/** Every group's row, then change requests (always emailed). */
export function EmailPreferencesList({
  preferences,
  disabled,
  onChange,
}: {
  preferences: Record<PreferenceGroupKey, { frequency: EmailFrequency; saved: boolean }>;
  disabled?: boolean;
  onChange: (group: PreferenceGroupKey, frequency: EmailFrequency) => void;
}) {
  return (
    <ItemGroup>
      {PREFERENCE_GROUPS.map(({ key }) => (
        <EmailPreferenceRow
          key={key}
          group={key}
          frequency={preferences[key].frequency}
          saved={preferences[key].saved}
          disabled={disabled}
          onChange={(frequency) => onChange(key, frequency)}
        />
      ))}
      <AlwaysEmailedRow />
    </ItemGroup>
  );
}
