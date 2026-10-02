import { beforeEach, describe, expect, it, vi } from "vitest";

// The avatar repository against a mocked Supabase client: the object path (the bucket's RLS only
// lets a user write inside `<user_id>/`), the profile update and the cleanup of older files.
const h = vi.hoisted(() => ({
  list: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://storage.test/avatars/${path}` } })),
  update: vi.fn(),
  eq: vi.fn(),
  bucket: vi.fn(),
  table: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => {
        h.bucket(bucket);
        return { list: h.list, upload: h.upload, remove: h.remove, getPublicUrl: h.getPublicUrl };
      },
    },
    from: (table: string) => {
      h.table(table);
      return {
        update: (values: unknown) => {
          h.update(values);
          return { eq: async (...args: unknown[]) => (h.eq(...args), { error: null }) };
        },
      };
    },
  },
}));

const { profileRepo } = await import("@/features/settings/data/profile.repo");
const { avatarPath, validateAvatar } = await import("@/features/settings/domain/profile");

const USER = "a0000000-0000-4000-8000-000000000001";

beforeEach(() => {
  for (const fn of [h.list, h.upload, h.remove, h.update, h.eq, h.bucket, h.table]) fn.mockReset();
  h.upload.mockResolvedValue({ data: {}, error: null });
  h.remove.mockResolvedValue({ data: [], error: null });
});

describe("avatar upload", () => {
  it("stores it under <user_id>/ in the avatars bucket and saves the public URL on the profile", async () => {
    h.list.mockResolvedValue({ data: [{ name: "avatar-1.jpg" }], error: null });
    const url = await profileRepo.uploadAvatar(USER, new Blob(["x"], { type: "image/jpeg" }));

    expect(h.bucket).toHaveBeenCalledWith("avatars");
    const [path, , options] = h.upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${USER}/avatar-\\d+\\.jpg$`));
    expect(options).toMatchObject({ contentType: "image/jpeg" });
    expect(url).toBe(`https://storage.test/avatars/${path}`);
    expect(h.table).toHaveBeenCalledWith("profiles");
    expect(h.update).toHaveBeenCalledWith({ avatar_url: url });
    expect(h.eq).toHaveBeenCalledWith("id", USER);
    // the previous file is removed after the new one is in place
    expect(h.remove).toHaveBeenCalledWith([`${USER}/avatar-1.jpg`]);
  });

  it("removing clears the URL and deletes everything in the user's folder", async () => {
    h.list.mockResolvedValue({ data: [{ name: "avatar-2.jpg" }], error: null });
    await profileRepo.removeAvatar(USER);
    expect(h.update).toHaveBeenCalledWith({ avatar_url: null });
    expect(h.remove).toHaveBeenCalledWith([`${USER}/avatar-2.jpg`]);
  });

  it("path and validation rules", () => {
    expect(avatarPath(USER, 1700000000000)).toBe(`${USER}/avatar-1700000000000.jpg`);
    expect(validateAvatar({ type: "image/png", size: 1024 })).toBeNull();
    expect(validateAvatar({ type: "image/heic", size: 1024 })).toBe("type");
    expect(validateAvatar({ type: "image/jpeg", size: 16 * 1024 * 1024 })).toBe("size");
  });
});
