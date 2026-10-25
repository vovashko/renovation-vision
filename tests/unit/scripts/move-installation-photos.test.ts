import { describe, expect, it } from "vitest";
import { planActions } from "../../../scripts/move-installation-photos";

const NOW = new Date("2026-10-25T12:00:00Z").getTime();
const old = "2026-10-01T00:00:00Z";
const P = "b0000000-0000-4000-8000-000000000001";

describe("planActions (scripts/move-installation-photos.ts)", () => {
  it("moves an installation photo that has a photos row to <project>/photos/<same file>", () => {
    const [a] = planActions([{ path: `${P}/installation_photos/a.jpg`, createdAt: old }], new Set(), new Set([`${P}/photos/a.jpg`]), NOW);
    expect(a).toEqual({ kind: "move", from: `${P}/installation_photos/a.jpg`, to: `${P}/photos/a.jpg` });
  });

  it("keeps every object a documents row points at", () => {
    const [a] = planActions([{ path: `${P}/contract/c.pdf`, createdAt: old }], new Set([`${P}/contract/c.pdf`]), new Set(), NOW);
    expect(a).toMatchObject({ kind: "skip", reason: "referenced" });
  });

  it("removes old unreferenced objects (deleted archived documents, photos without a row)", () => {
    const actions = planActions(
      [
        { path: `${P}/invoices/archived.pdf`, createdAt: old },
        { path: `${P}/installation_photos/archived.jpg`, createdAt: old },
      ],
      new Set(),
      new Set(),
      NOW,
    );
    expect(actions.map((a) => a.kind)).toEqual(["remove", "remove"]);
  });

  it("never touches an unreferenced object younger than an hour (an upload in flight)", () => {
    const [a] = planActions([{ path: `${P}/invoices/new.pdf`, createdAt: "2026-10-25T11:30:00Z" }], new Set(), new Set(), NOW);
    expect(a).toMatchObject({ kind: "skip", reason: "recent" });
  });
});
