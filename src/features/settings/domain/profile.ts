// Pure rules for Settings → Profile: the name form and the avatar upload.
//
// The `avatars` bucket (supabase/migrations/20260925000100_avatars.sql) is public-read, takes
// jpeg/png/webp up to 5 MB, and lets each user write only inside their own `<user_id>/` folder.
// The picked image is re-encoded in the browser before upload (features/media's EXIF/GPS strip,
// capped at AVATAR_DIMENSION px), so what's stored is a small metadata-free JPEG; the input may be
// bigger than the bucket's 5 MB, up to the same 15 MB photo uploads accept.
import { z } from "zod";
import { MAX_UPLOAD_BYTES, allowedMimeTypes } from "@/features/media/domain/upload";

export const AVATAR_BUCKET = "avatars";
/** Longest edge of the stored avatar, in px (it's shown at ≤ 64 px, 2–3× for dense screens). */
export const AVATAR_DIMENSION = 512;
export const AVATAR_MAX_INPUT_BYTES = MAX_UPLOAD_BYTES;
/** jpeg/png/webp: what the bucket accepts and the browser can re-encode (never HEIC). */
export const AVATAR_TYPES = allowedMimeTypes("render");

export type AvatarRejection = "type" | "size";

export function validateAvatar(file: { type: string; size: number }): AvatarRejection | null {
  if (!AVATAR_TYPES.includes(file.type)) return "type";
  if (file.size > AVATAR_MAX_INPUT_BYTES) return "size";
  return null;
}

/**
 * Where an avatar is stored: inside the user's own folder (the bucket's RLS requires
 * `<user_id>/…`), under a new name each time so the public URL changes and no cache shows the old one.
 */
export function avatarPath(userId: string, now: number = Date.now()): string {
  return `${userId}/avatar-${now}.jpg`;
}

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "common:form.required").max(120, "settings:profile.nameTooLong"),
});
