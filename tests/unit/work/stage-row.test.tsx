import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StageRow } from "@/features/work/ui/stage-row";

afterEach(cleanup);

const props = { index: 1, name: "Walls", start: "1 Apr", end: "10 Apr", status: "progress" as const, progress: 40, tasks: [] };

describe("StageRow progress bar", () => {
  it("is red when the stage is late", () => {
    render(<StageRow {...props} lateDays={3} />);
    expect(screen.getByRole("progressbar").className).toMatch(/bg-status-blocked/);
  });

  it("keeps its status colour when the stage is on time", () => {
    render(<StageRow {...props} />);
    expect(screen.getByRole("progressbar").className).not.toMatch(/bg-status-blocked/);
  });
});
