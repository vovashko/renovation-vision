// The signed-in user's own profile row (`profiles.full_name`, `profiles.avatar_url`: the only two
// columns `authenticated` may update) and their files in the public `avatars` bucket.
import { supabase } from "@/lib/supabase";
import { AVATAR_BUCKET, avatarPath } from "../domain/profile";

async function listOwnAvatars(userId: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  if (error) throw error;
  return (data ?? []).map((object) => `${userId}/${object.name}`);
}

async function setAvatarUrl(userId: string, url: string | null): Promise<void> {
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (error) throw error;
}

export const profileRepo = {
  async updateFullName(userId: string, fullName: string): Promise<void> {
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", userId);
    if (error) throw error;
  },

  /**
   * Uploads an (already re-encoded) avatar to `<user_id>/avatar-<time>.jpg`, points
   * `profiles.avatar_url` at its public URL, then removes the user's older avatar files. Returns the URL.
   */
  async uploadAvatar(userId: string, file: Blob): Promise<string> {
    const previous = await listOwnAvatars(userId);
    const path = avatarPath(userId);
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    const url = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
    await setAvatarUrl(userId, url);
    if (previous.length) await supabase.storage.from(AVATAR_BUCKET).remove(previous); // best effort: a leftover only costs storage
    return url;
  },

  /** Clears `profiles.avatar_url` and deletes every file in the user's avatar folder. */
  async removeAvatar(userId: string): Promise<void> {
    await setAvatarUrl(userId, null);
    const files = await listOwnAvatars(userId);
    if (files.length) {
      const { error } = await supabase.storage.from(AVATAR_BUCKET).remove(files);
      if (error) throw error;
    }
  },
};
