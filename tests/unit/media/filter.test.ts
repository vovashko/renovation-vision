import { describe, it, expect } from "vitest";
import { filterPhotos, groupPhotosByDate, toLightboxItem } from "@/features/media/domain/photo-helpers";
import type { Photo } from "@/lib/database.types";

function photo(overrides: Partial<Photo> = {}): Photo {
  return {
    id: overrides.id ?? "p1",
    project_id: "proj-1",
    stage_id: null,
    room_id: null,
    progress_entry_id: null,
    storage_path: "path.jpg",
    alt: "A photo",
    caption: "A caption",
    taken_at: "2026-04-20T10:00:00.000Z",
    uploaded_by: null,
    status: "published",
    published_at: null,
    url: "https://example.com/path.jpg",
    ...overrides,
  };
}

describe("filterPhotos", () => {
  const photos = [
    photo({ id: "1", stage_id: "wall", room_id: "living" }),
    photo({ id: "2", stage_id: "floor", room_id: "living" }),
    photo({ id: "3", stage_id: "wall", room_id: "kitchen" }),
  ];

  it("returns everything when given no filter", () => {
    expect(filterPhotos(photos)).toEqual(photos);
  });

  it("filters by stage", () => {
    expect(filterPhotos(photos, { stageId: "wall" }).map((p) => p.id)).toEqual(["1", "3"]);
  });

  it("filters by room", () => {
    expect(filterPhotos(photos, { roomId: "living" }).map((p) => p.id)).toEqual(["1", "2"]);
  });

  it("combines stage and room filters", () => {
    expect(filterPhotos(photos, { stageId: "wall", roomId: "kitchen" }).map((p) => p.id)).toEqual(["3"]);
  });

  it("treats 'all' as no filter, for either dimension", () => {
    expect(filterPhotos(photos, { stageId: "all", roomId: "all" })).toEqual(photos);
    expect(filterPhotos(photos, { stageId: "all", roomId: "kitchen" }).map((p) => p.id)).toEqual(["3"]);
  });

  it("returns an empty array for empty input", () => {
    expect(filterPhotos([], { stageId: "wall" })).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterPhotos(photos, { stageId: "demo" })).toEqual([]);
  });
});

describe("groupPhotosByDate", () => {
  it("groups consecutive photos sharing a calendar day, preserving input order", () => {
    const photos = [
      photo({ id: "1", taken_at: "2026-04-20T10:00:00" }),
      photo({ id: "2", taken_at: "2026-04-20T08:00:00" }),
      photo({ id: "3", taken_at: "2026-04-19T16:00:00" }),
      photo({ id: "4", taken_at: "2026-03-10T09:00:00" }),
    ];
    const groups = groupPhotosByDate(photos);
    expect(groups).toHaveLength(3);
    expect(groups[0].items.map((p) => p.id)).toEqual(["1", "2"]);
    expect(groups[0].date).toBe("2026-04-20T10:00:00");
    expect(groups[1].items.map((p) => p.id)).toEqual(["3"]);
    expect(groups[2].items.map((p) => p.id)).toEqual(["4"]);
  });

  it("does not merge same-day photos that are not adjacent in the input", () => {
    const photos = [
      photo({ id: "1", taken_at: "2026-04-20T10:00:00" }),
      photo({ id: "2", taken_at: "2026-04-19T16:00:00" }),
      photo({ id: "3", taken_at: "2026-04-20T08:00:00" }),
    ];
    const groups = groupPhotosByDate(photos);
    expect(groups.map((g) => g.items.map((p) => p.id))).toEqual([["1"], ["2"], ["3"]]);
  });

  it("returns an empty array for empty input", () => {
    expect(groupPhotosByDate([])).toEqual([]);
  });
});

describe("toLightboxItem", () => {
  it("uses the caption as the title when present", () => {
    const item = toLightboxItem(photo({ caption: "New tiles" }), { fallbackTitle: "Site photo", subtitle: "20 Apr", tags: ["Kitchen"] });
    expect(item).toEqual({
      src: "https://example.com/path.jpg",
      alt: "A photo",
      title: "New tiles",
      subtitle: "20 Apr",
      tags: ["Kitchen"],
    });
  });

  it("falls back to the given title when there is no caption", () => {
    const item = toLightboxItem(photo({ caption: "" }), { fallbackTitle: "Site photo" });
    expect(item.title).toBe("Site photo");
  });
});
