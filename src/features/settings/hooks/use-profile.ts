import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { updateUserLocale } from "@/features/auth/hooks";
import { reencodeImage } from "@/features/media/domain/strip-exif";
import { useSetLocale, type Locale } from "@/i18n";
import { useAuth, useSessionRefresh } from "@/lib/auth";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { profileRepo } from "../data/profile.repo";
import { AVATAR_DIMENSION } from "../domain/profile";

/**
 * Name and photo come from the session (`getSession` reads the profile), so after saving either
 * the session is re-read: the rail avatar, the profile panel and every page update at once.
 */
function useProfileMutation<V>(fn: (userId: string, vars: V) => Promise<unknown>, success: string) {
  const { userId } = useAuth();
  const refresh = useSessionRefresh();
  return useMutationWithToast(
    async (vars: V) => {
      if (!userId) throw new Error("Not signed in");
      await fn(userId, vars);
      await refresh();
    },
    { success },
  );
}

export function useUpdateFullName() {
  const { t } = useTranslation(["settings"]);
  return useProfileMutation((userId, fullName: string) => profileRepo.updateFullName(userId, fullName), t("profile.saved"));
}

/** Strips EXIF/GPS and shrinks the picture to AVATAR_DIMENSION px (features/media's re-encode), then uploads it. */
export function useUploadAvatar() {
  const { t } = useTranslation(["settings"]);
  return useProfileMutation(async (userId, file: File) => {
    const { file: processed } = await reencodeImage(file, AVATAR_DIMENSION);
    return profileRepo.uploadAvatar(userId, processed);
  }, t("avatar.saved"));
}

/**
 * Switches the UI language and saves it everywhere it lives, in this order:
 *
 *   1. the cookie + i18next (`useSetLocale`): the page re-renders in the new language at once, and
 *      a signed-out visit keeps it;
 *   2. `profiles.locale`, the source of truth the server renders a signed-in user's pages in (a
 *      failure toasts: the next hard load would come back in the old language);
 *   3. `user_metadata.locale` for the Supabase Auth email templates (best-effort). Its USER_UPDATED
 *      event makes AuthSync re-read the session, which by then carries the new profile locale.
 */
export function useSaveLocale(): (locale: Locale) => Promise<void> {
  const { t } = useTranslation(["settings"]);
  const { userId } = useAuth();
  const setLocale = useSetLocale();
  return useCallback(
    async (locale: Locale) => {
      await setLocale(locale);
      if (!userId) return;
      try {
        await profileRepo.updateLocale(userId, locale);
      } catch {
        toast.error(t("language.saveFailed"));
      }
      await updateUserLocale(locale).catch(() => {
        // Best-effort: a hosted auth email may render in the previous language until the next change.
      });
    },
    [setLocale, userId, t],
  );
}

export function useRemoveAvatar() {
  const { t } = useTranslation(["settings"]);
  return useProfileMutation((userId, _vars: void) => profileRepo.removeAvatar(userId), t("avatar.removed"));
}
