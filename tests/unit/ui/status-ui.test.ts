import { describe, it, expect } from "vitest";
import { statuses } from "@/lib/status";
import {
  statusChip,
  statusTone,
  statusBg,
  statusContainer,
  statusMarker,
  statusTileSvg,
  statusStroke,
  statusOutline,
} from "@/lib/status-ui";

const maps = {
  statusChip,
  statusTone,
  statusBg,
  statusContainer,
  statusMarker,
  statusTileSvg,
  statusStroke,
  statusOutline,
};

describe("status-ui maps", () => {
  for (const [name, map] of Object.entries(maps)) {
    it(`${name} has an entry for every status`, () => {
      for (const status of statuses) {
        expect(map[status]).toBeTruthy();
      }
    });
  }
});

describe("pending is hollow, never a pale fill", () => {
  it("statusBg's pending dot is a hollow ring, not a filled dot", () => {
    expect(statusBg.pending).toContain("border");
    expect(statusBg.pending).not.toContain("bg-status-pending ");
    expect(statusBg.pending).not.toMatch(/^bg-status-pending$/);
  });

  it("statusContainer's pending chip has a dashed outline and no separate pale fill class", () => {
    expect(statusContainer.pending).toContain("border");
    expect(statusContainer.pending).toContain("dashed");
  });

  it("statusTone maps pending to the pending progress tone", () => {
    expect(statusTone.pending).toBe("pending");
  });
});
