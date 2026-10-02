import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/lib/auth";
import { useRemoveAvatar, useUploadAvatar } from "../hooks/use-profile";
import { AVATAR_TYPES, validateAvatar, type AvatarRejection } from "../domain/profile";

/** Settings → Profile: the profile photo (public `avatars` bucket, `<user_id>/…`). */
export function AvatarForm({ className }: { className?: string }) {
  const { t } = useTranslation(["settings"]);
  const { profile } = useAuth();
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const input = useRef<HTMLInputElement>(null);
  const [rejection, setRejection] = useState<AvatarRejection | null>(null);
  const busy = upload.isPending || remove.isPending;

  const pick = (file: File | undefined) => {
    if (!file) return;
    const problem = validateAvatar(file);
    setRejection(problem);
    if (!problem) upload.mutate(file, { onSettled: () => input.current && (input.current.value = "") });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t("avatar.title")}</CardTitle>
        <CardDescription>{t("avatar.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <UserAvatar name={profile?.full_name ?? ""} src={profile?.avatar_url} className="size-16 text-headline-md" />
          {profile?.avatar_url && (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => remove.mutate()}>
              {t("avatar.remove")}
            </Button>
          )}
        </div>
        <FileInput
          ref={input}
          accept={AVATAR_TYPES.join(",")}
          aria-label={t("avatar.pick")}
          aria-invalid={!!rejection}
          disabled={busy}
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {upload.isPending && <p className="text-body-sm text-on-surface-variant">{t("avatar.uploading")}</p>}
        {rejection && <FieldError>{t(rejection === "type" ? "avatar.wrongType" : "avatar.tooBig")}</FieldError>}
      </CardContent>
    </Card>
  );
}
