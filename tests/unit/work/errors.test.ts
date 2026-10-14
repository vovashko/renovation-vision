import { describe, it, expect } from "vitest";
import { matchWorkError } from "@/features/work/domain/errors";

describe("matchWorkError", () => {
  it("maps the documents foreign key to the installation-photos message", () => {
    const raw = 'update or delete on table "rooms" violates foreign key constraint "documents_room_id_fkey" on table "documents"';
    expect(matchWorkError(raw)).toEqual({ key: "work:errors.roomHasInstallationPhotos" });
  });

  it("leaves unknown messages alone", () => {
    expect(matchWorkError("something else")).toBeNull();
  });
});
