import { describe, it, expect } from "vitest";
import { matchWorkError } from "@/features/work/domain/errors";

describe("matchWorkError", () => {
  it("leaves unknown messages alone", () => {
    expect(matchWorkError("something else")).toBeNull();
  });
});
