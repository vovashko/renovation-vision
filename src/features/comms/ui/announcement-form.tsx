import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { announcementSchema, type AnnouncementInput } from "@/features/comms/domain/schemas";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";

export type AnnouncementLink = { value: string; label: string };

/** The "Send an announcement" panel on the Updates page. */
export function AnnouncementForm({
  onSubmit,
  pending,
  clientCount,
  links,
}: {
  onSubmit: (values: AnnouncementInput) => void;
  pending: boolean;
  clientCount: number;
  links: AnnouncementLink[];
}) {
  const { t } = useTranslation(["comms", "common"]);
  const defaults = { title: "", body: "", link: links[0]?.value ?? "" };
  const form = useZodForm(announcementSchema, defaults);

  const submit = form.handleSubmit((values) => {
    onSubmit(values);
    form.reset(defaults);
  });

  return (
    <Card className="h-fit p-5">
      <form noValidate onSubmit={submit}>
        <h2 className="mb-4 flex items-center gap-2 text-title-md">
          <Icon name="send" size={20} /> {t("updates.announcement.heading")}
        </h2>
        <FieldGroup>
          <FormField control={form.control} name="title" label={t("updates.announcement.titleLabel")}>
            {(field) => <Input {...field} maxLength={80} placeholder={t("updates.announcement.titlePlaceholder")} />}
          </FormField>
          <FormField control={form.control} name="body" label={t("updates.announcement.bodyLabel")}>
            {(field) => <Textarea {...field} />}
          </FormField>
          <FormField control={form.control} name="link" label={t("updates.announcement.linkLabel")}>
            {(field) => (
              <NativeSelect {...field}>
                {links.map((l) => (
                  <NativeSelectOption key={l.value} value={l.value}>
                    {l.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <Button type="submit" disabled={pending || clientCount === 0} className="w-full">
            {clientCount === 0 ? t("updates.announcement.inviteFirst") : t("updates.announcement.submit", { count: clientCount })}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}
