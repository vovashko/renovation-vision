import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FloorPlan, type FloorPlanRoom } from "@/components/floor-plan";

afterEach(cleanup);

const rooms: FloorPlanRoom[] = [
  { id: "kitchen", name: "Kitchen", status: "pending", progress: 0, x: 20, y: 20, w: 160, h: 120 },
  { id: "bath", name: "Bathroom", status: "done", progress: 100, x: 200, y: 20, w: 120, h: 120 },
  { id: "hall", name: "Hallway", status: "progress", progress: 40, x: 20, y: 160, w: 160, h: 100 },
];

describe("FloorPlan", () => {
  it("renders every room by name and progress", () => {
    render(<FloorPlan rooms={rooms} />);
    expect(screen.getByRole("button", { name: /Kitchen: Pending, 0%/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bathroom: Completed, 100%/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hallway: In progress, 40%/ })).toBeInTheDocument();
  });

  it("calls onSelect with the clicked room", () => {
    const onSelect = vi.fn();
    render(<FloorPlan rooms={rooms} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /Hallway/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(rooms[2]);
  });

  it("gives the selected room an outline in its own status color", () => {
    render(<FloorPlan rooms={rooms} activeId="hall" onSelect={() => {}} />);
    const hall = screen.getByRole("button", { name: /Hallway/ });
    expect(hall).toHaveClass("outline-status-progress");
  });

  it("a pending room's selected outline is solid outline-outline, not a status color", () => {
    render(<FloorPlan rooms={rooms} activeId="kitchen" onSelect={() => {}} />);
    const kitchen = screen.getByRole("button", { name: /Kitchen/ });
    expect(kitchen).toHaveClass("outline-outline");
    expect(kitchen).not.toHaveClass("border-dashed");
  });

  it("leaves non-selected rooms without a selection outline", () => {
    render(<FloorPlan rooms={rooms} activeId="hall" onSelect={() => {}} />);
    const bath = screen.getByRole("button", { name: /Bathroom/ });
    expect(bath).not.toHaveClass("outline-status-done");
    expect(bath.className).not.toMatch(/(?<!focus-visible:)outline-2\b/);
  });
});
