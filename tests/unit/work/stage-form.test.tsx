import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// The stage form against a mocked Supabase client (the real repository and mutation hooks on top).
const h = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      update: (input: unknown) => {
        h.update(input);
        return { eq: async () => ({ data: null, error: null }) };
      },
    }),
  },
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { StageFormSheet } from "@/features/work/ui/stage-form";
import { ProgressModeControl, TaskDerivedProgress } from "@/features/work/ui/stage-progress-mode";
import { ConfirmContext } from "@/shared/ui/use-confirm";
import type { Stage, Task } from "@/lib/database.types";

const task = (id: string, done: boolean): Task => ({
  id,
  project_id: "p1",
  stage_id: "s1",
  room_id: null,
  name: `Task ${id}`,
  done,
  in_progress: false,
  sort_order: 0,
  is_visible: true,
});

const stage = (patch: Partial<Stage> = {}): Stage => ({
  id: "s1",
  project_id: "p1",
  key: "wall",
  name: "Walls & Insulation",
  status: "progress",
  progress: 50,
  progress_mode: "tasks",
  start_date: "2026-04-03",
  end_date: "2026-04-24",
  client_note: "",
  sort_order: 1,
  is_visible: true,
  tasks: [task("a", true), task("b", false)],
  ...patch,
});

function renderSheet(s: Stage) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ConfirmContext.Provider value={async () => true}>{children}</ConfirmContext.Provider>
    </QueryClientProvider>
  );
  return render(<StageFormSheet projectId="p1" stage={s} rooms={[]} count={1} onClose={() => {}} />, { wrapper });
}

beforeEach(() => h.update.mockReset());

describe("StageFormSheet progress mode", () => {
  it("tasks mode shows progress and status read-only, computed from the checklist", () => {
    renderSheet(stage());
    expect(screen.getByRole("radio", { name: "Automatic" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/Progress is calculated from the checklist: 1 of 2 tasks done\./)).toBeInTheDocument();
    expect(screen.getByText("Progress — 50%")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument();
  });

  it("manual mode makes progress and status editable, and switching back recomputes them", () => {
    renderSheet(stage({ progress_mode: "manual", progress: 65 }));
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByText("Progress — 65%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Automatic" }));
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByText("Progress — 50%")).toBeInTheDocument();
  });

  it("blocked can still be set in tasks mode, and is saved with the mode", async () => {
    renderSheet(stage());
    fireEvent.click(screen.getByRole("switch", { name: "Blocked" }));
    expect(screen.getByRole("switch", { name: "Blocked" })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("button", { name: "Save stage" }));
    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1));
    expect(h.update.mock.calls[0][0]).toMatchObject({ progress_mode: "tasks", status: "blocked", progress: 50 });
  });

  it("a blocked stage whose tasks are all done stays blocked at 99%", () => {
    renderSheet(stage({ status: "blocked", progress: 99, tasks: [task("a", true), task("b", true)] }));
    expect(screen.getByText("Progress — 99%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Blocked" }));
    expect(screen.getByText("Progress — 100%")).toBeInTheDocument();
  });
});

describe("TaskDerivedProgress", () => {
  it("shows the derived status and reports blocked changes", () => {
    const onBlockedChange = vi.fn();
    render(<TaskDerivedProgress status="pending" progress={0} onBlockedChange={onBlockedChange} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Blocked" }));
    expect(onBlockedChange).toHaveBeenCalledWith(true);
  });
});

describe("ProgressModeControl", () => {
  it("marks the current mode and reports a change", () => {
    const onChange = vi.fn();
    render(<ProgressModeControl value="manual" onChange={onChange} done={0} total={0} />);
    expect(screen.getByRole("radiogroup", { name: "Progress" })).toBeInTheDocument();
    expect(screen.getByText("You set the status and progress yourself.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Manual" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Automatic" }));
    expect(onChange).toHaveBeenCalledWith("tasks");
  });

  it("explains the automatic mode right below the switch, including an empty checklist", () => {
    const { rerender } = render(<ProgressModeControl value="tasks" onChange={vi.fn()} done={2} total={5} />);
    expect(screen.getByText("Progress is calculated from the checklist: 2 of 5 tasks done.")).toBeInTheDocument();
    rerender(<ProgressModeControl value="tasks" onChange={vi.fn()} done={0} total={0} />);
    expect(screen.getByText(/which has no tasks yet/)).toBeInTheDocument();
  });
});
