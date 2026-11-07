import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useAuth } from "@/lib/auth";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { commsRepo } from "@/features/comms/data/comms.repo";
import type { EmailFrequency, PreferenceGroupKey } from "@/features/comms/domain/delivery";

export type { EmailPreference, EmailPreferences } from "@/features/comms/data/comms.repo";

/** The signed-in user's email frequency per notification group: saved, or the default for their role. */
export function useEmailPreferences() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: keys.notificationPreferences(userId ?? ""),
    queryFn: () => commsRepo.emailPreferences(userId!),
    enabled: !!userId,
  });
}

export function useSaveEmailPreference() {
  const { userId } = useAuth();
  const { t } = useTranslation(["comms"]);
  return useMutationWithToast(
    (vars: { group: PreferenceGroupKey; frequency: EmailFrequency }) => commsRepo.saveEmailPreference(userId!, vars.group, vars.frequency),
    { invalidate: [keys.notificationPreferences(userId ?? "")], success: t("preferences.saved") },
  );
}
