import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StageRow } from "@/features/work/ui/stage-row";

afterEach(cleanup);

const props = { index: 1, name: "Walls", start: "1 Apr", end: "10 Apr", status: "progress" as const, progress: 40, tasks: [] };

describe("StageRow progress bar", () => {
  it("is orange, never red, when the stage is overdue", () => {
    render(<StageRow {...props} lateDays={3} />);
    const cls = screen.getByRole("progressbar").className;
    expect(cls).toMatch(/bg-attention/);
    expect(cls).not.toMatch(/bg-status-blocked/);
  });

  it("is red only when the stage itself is blocked", () => {
    render(<StageRow {...props} status="blocked" lateDays={3} />);
    expect(screen.getByRole("progressbar").className).toMatch(/bg-status-blocked/);
  });

  it("keeps its status colour when the stage is on time", () => {
    render(<StageRow {...props} />);
    const cls = screen.getByRole("progressbar").className;
    expect(cls).not.toMatch(/bg-status-blocked/);
    expect(cls).not.toMatch(/bg-attention/);
  });
});

describe("StageRow approval badge", () => {
  it("shows Waiting for client approval when a change request is pending", () => {
    render(<StageRow {...props} waitingApproval />);
    expect(screen.getByText(/waiting for client approval/i)).toBeTruthy();
  });

  it("shows nothing otherwise", () => {
    render(<StageRow {...props} />);
    expect(screen.queryByText(/waiting for client approval/i)).toBeNull();
  });
});
