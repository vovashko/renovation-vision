import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import { useUpdateFullName } from "../hooks/use-profile";
import { profileSchema } from "../domain/profile";

/** Settings → Profile: the name shown to everyone on your projects (`profiles.full_name`). */
export function ProfileForm({ className }: { className?: string }) {
  const { t } = useTranslation(["settings", "common"]);
  const { profile } = useAuth();
  const form = useZodForm(profileSchema, { fullName: profile?.full_name ?? "" });
  const save = useUpdateFullName();
  const submit = form.handleSubmit(({ fullName }) => save.mutate(fullName));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t("profile.nameTitle")}</CardTitle>
        <CardDescription>{t("profile.nameDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <FormField control={form.control} name="fullName" label={t("profile.name")}>
            {(field) => <Input autoComplete="name" {...field} />}
          </FormField>
          <Button type="submit" className="self-start" disabled={save.isPending}>
            {t("common:actions.save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
