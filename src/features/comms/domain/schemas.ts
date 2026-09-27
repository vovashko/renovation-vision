// Pure zod schemas for comms forms. No React, no Supabase — validation messages are i18n keys,
// translated by `<FormField>` (announcement) or read directly off the composer's parsed error (chat).
import { z } from "zod";

/** The "Send an announcement" form on the Updates page. Link is optional (no target page chosen). */
export const announcementSchema = z.object({
  title: z.string().trim().min(1, "common:form.required").max(80, "common:form.invalid"),
  body: z.string().trim().min(1, "common:form.required"),
  link: z
    .string()
    .trim()
    .transform((v) => v || null),
});
export type AnnouncementInput = z.output<typeof announcementSchema>;

/** A chat message body is capped generously; longer text should be an attachment instead. */
export const MAX_MESSAGE_LENGTH = 4000;

/**
 * A message needs a non-empty (trimmed) body, an attachment, or both — never neither — and the
 * body can't exceed `MAX_MESSAGE_LENGTH`. Used to gate the composer's send button and to validate
 * before submitting.
 */
export const messageSchema = z
  .object({
    body: z.string().max(MAX_MESSAGE_LENGTH, "comms:chat.composer.tooLong"),
    hasAttachment: z.boolean(),
  })
  .refine((v) => v.hasAttachment || v.body.trim().length > 0, { message: "comms:chat.composer.empty", path: ["body"] });
export type MessageInput = z.input<typeof messageSchema>;

/** True when a message with this body/attachment is ready to send. */
export function canSendMessage(body: string, hasAttachment: boolean): boolean {
  return messageSchema.safeParse({ body, hasAttachment }).success;
}
