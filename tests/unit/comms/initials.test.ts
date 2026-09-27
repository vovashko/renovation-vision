import { describe, it, expect } from "vitest";
import { initials } from "@/components/ui/avatar-initials";

describe("initials", () => {
  it("takes the first letter of the first and last name", () => {
    expect(initials("Jonas Weber")).toBe("JW");
  });

  it("falls back to the first two letters of a single name", () => {
    expect(initials("Cher")).toBe("CH");
  });

  it("falls back to '?' for an empty name", () => {
    expect(initials("")).toBe("?");
  });
});
