import { describe, it, expect } from "vitest";
import { parseDate, slugify, fileExt } from "@/lib/format";

describe("parseDate", () => {
  it("parses 'YYYY-MM-DD' as a local date with no timezone shift", () => {
    const d = parseDate("2026-04-20");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // 0-indexed: April
    expect(d.getDate()).toBe(20);
  });
});

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
