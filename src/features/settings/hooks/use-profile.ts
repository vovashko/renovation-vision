import { useTranslation } from "react-i18next";
import { reencodeImage } from "@/features/media/domain/strip-exif";
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

export function useRemoveAvatar() {
  const { t } = useTranslation(["settings"]);
  return useProfileMutation((userId, _vars: void) => profileRepo.removeAvatar(userId), t("avatar.removed"));
}
