import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProjectHeader } from "@/features/work/ui/project-header";

afterEach(cleanup);

const props = { name: "Elm Road", address: "Elm Road 1", progress: 40 };

describe("ProjectHeader progress bar", () => {
  it("is red when the project is behind schedule", () => {
    render(<ProjectHeader {...props} behind />);
    expect(screen.getByRole("progressbar").className).toMatch(/bg-status-blocked/);
  });

  it("keeps the default colour when on schedule", () => {
    render(<ProjectHeader {...props} />);
    expect(screen.getByRole("progressbar").className).not.toMatch(/bg-status-blocked/);
  });
});
