import { describe, it, expect } from "vitest";
import { deriveStatus, progressForStatus, statusForProgress } from "@/lib/status-progress";

describe("deriveStatus", () => {
  it("0% is pending", () => {
    expect(deriveStatus("progress", 0)).toBe("pending");
    expect(deriveStatus("pending", 0)).toBe("pending");
    expect(deriveStatus("done", 0)).toBe("pending");
  });

  it("1% is progress", () => {
    expect(deriveStatus("pending", 1)).toBe("progress");
  });

  it("99% is progress, not done", () => {
    expect(deriveStatus("pending", 99)).toBe("progress");
    expect(deriveStatus("done", 99)).toBe("progress");
  });

  it("100% is done", () => {
    expect(deriveStatus("pending", 100)).toBe("done");
    expect(deriveStatus("progress", 100)).toBe("done");
  });

  it("blocked is kept regardless of progress", () => {
    expect(deriveStatus("blocked", 0)).toBe("blocked");
    expect(deriveStatus("blocked", 1)).toBe("blocked");
    expect(deriveStatus("blocked", 50)).toBe("blocked");
    expect(deriveStatus("blocked", 99)).toBe("blocked");
    // Blocked only stops being blocked when 100% is reached — the database ties done to 100%.
    expect(deriveStatus("blocked", 100)).toBe("done");
  });
});

describe("statusForProgress (progress slider moved)", () => {
  it("moving to 0% clears any non-blocked status back to pending", () => {
    expect(statusForProgress("done", 0)).toBe("pending");
    expect(statusForProgress("progress", 0)).toBe("pending");
  });

  it("moving above 0% and below 100% is always progress, unless blocked", () => {
    expect(statusForProgress("pending", 1)).toBe("progress");
    expect(statusForProgress("pending", 99)).toBe("progress");
    expect(statusForProgress("done", 50)).toBe("progress");
  });

  it("moving to 100% is always done", () => {
    expect(statusForProgress("pending", 100)).toBe("done");
    expect(statusForProgress("blocked", 100)).toBe("done");
  });

  it("blocked stays blocked at any progress short of 100%", () => {
    expect(statusForProgress("blocked", 0)).toBe("blocked");
    expect(statusForProgress("blocked", 1)).toBe("blocked");
    expect(statusForProgress("blocked", 99)).toBe("blocked");
  });
});

describe("progressForStatus (status picked by hand)", () => {
  it("done always sets 100%", () => {
    expect(progressForStatus("done", 40)).toBe(100);
  });

  it("pending always sets 0%", () => {
    expect(progressForStatus("pending", 40)).toBe(0);
  });

  it("progress/blocked keep an in-between progress unchanged", () => {
    expect(progressForStatus("progress", 40)).toBe(40);
    expect(progressForStatus("blocked", 40)).toBe(40);
  });

  it("progress/blocked pull 100% down to 95% so it doesn't silently mean done", () => {
    expect(progressForStatus("progress", 100)).toBe(95);
    expect(progressForStatus("blocked", 100)).toBe(95);
  });

  it("progress/blocked bump 0% up to 5% so it doesn't silently mean pending", () => {
    expect(progressForStatus("progress", 0)).toBe(5);
    expect(progressForStatus("blocked", 0)).toBe(5);
  });
});
