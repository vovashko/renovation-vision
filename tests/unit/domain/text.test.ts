import { describe, it, expect } from "vitest";
import { fileExt, slugify } from "@/domain/text";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Living Room Drywall")).toBe("living-room-drywall");
  });

  it("strips leading/trailing separators", () => {
    expect(slugify("--Hello World!!--")).toBe("hello-world");
  });

  it("truncates to 24 characters", () => {
    expect(slugify("a".repeat(40))).toBe("a".repeat(24));
  });

  it("falls back to 'item' when nothing is left", () => {
    expect(slugify("!!!")).toBe("item");
  });
});

describe("fileExt", () => {
  it("returns the lowercased extension", () => {
    expect(fileExt("photo.JPG")).toBe("jpg");
    expect(fileExt("receipt.pdf")).toBe("pdf");
  });

  it("defaults to 'jpg' when there is no extension", () => {
    expect(fileExt("no-extension")).toBe("jpg");
  });
});
