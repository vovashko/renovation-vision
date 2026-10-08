import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// The room view's sections against a mocked Supabase client (the real repository and mutation hooks on top).
const h = vi.hoisted(() => ({ update: vi.fn(), insert: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      update: (input: unknown) => {
        h.update(input);
        return { eq: async () => ({ data: null, error: null }) };
      },
      insert: async (input: unknown) => {
        h.insert(input);
        return { data: null, error: null };
      },
    }),
  },
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { RoomMaterials } from "@/features/work/ui/room-materials";
import { RoomWarnings } from "@/features/work/ui/room-warnings";
import { RoomWorks } from "@/features/work/ui/room-works";
import { ConfirmContext } from "@/shared/ui/use-confirm";
import type { RoomMaterial, RoomWarning, Task } from "@/lib/database.types";

const material = (patch: Partial<RoomMaterial> & Pick<RoomMaterial, "id" | "name" | "status">): RoomMaterial => ({
  project_id: "p1",
  room_id: "r1",
  quantity: 1,
  unit: "pcs",
  order_by_date: null,
  delivery_date: null,
  ...patch,
});

const warning = (patch: Partial<RoomWarning> = {}): RoomWarning => ({
  id: "w1",
  project_id: "p1",
  room_id: "r1",
  text: "The worktop is not ordered yet.",
  created_by: null,
  created_at: "2026-05-01T10:00:00Z",
  material_ids: [],
  ...patch,
});

const task = (patch: Partial<Task> & Pick<Task, "id" | "name">): Task => ({
  project_id: "p1",
  stage_id: null,
  room_id: "r1",
  done: false,
  in_progress: false,
  sort_order: 1,
  is_visible: true,
  ...patch,
});

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConfirmContext.Provider value={async () => true}>{ui}</ConfirmContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.update.mockReset();
  h.insert.mockReset();
});

describe("RoomMaterials", () => {
  const materials = [
    material({ id: "m1", name: "Quartz worktop", status: "planned", order_by_date: "2026-05-12" }),
    material({ id: "m2", name: "Kitchen cabinets", status: "ordered", delivery_date: "2026-05-06", quantity: 2, unit: "set" }),
    material({ id: "m3", name: "Wall tiles", status: "delivered", delivery_date: "2026-04-15" }),
    material({ id: "m4", name: "Drywall", status: "installed" }),
  ];

  it("colours each material by status: red planned, orange ordered, green delivered/installed", () => {
    wrap(<RoomMaterials projectId="p1" roomId="r1" materials={materials} isManager={false} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((r) => r.getAttribute("data-tone"))).toEqual(["red", "orange", "green", "green"]);
    expect(within(rows[0]).getByText("Not ordered")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Ordered")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Delivered")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Installed")).toBeInTheDocument();
  });

  it("shows the order-by date for a planned material and the delivery date for an ordered one", () => {
    wrap(<RoomMaterials projectId="p1" roomId="r1" materials={materials} isManager={false} />);
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText(/^Order by .+ at the latest$/)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/^Delivery /)).toBeInTheDocument();
    expect(within(rows[1]).getByText("2 set")).toBeInTheDocument();
    expect(within(rows[3]).queryByText(/Delivered|Delivery|Order by/)).not.toBeInTheDocument();
  });

  it("is read-only for a client: no add, edit or remove, and no prices anywhere", () => {
    wrap(<RoomMaterials projectId="p1" roomId="r1" materials={materials} isManager={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/zł|PLN|€|price/i);
  });

  it("lets a manager add a material with its dates, without a price", async () => {
    wrap(<RoomMaterials projectId="p1" roomId="r1" materials={[]} isManager />);
    expect(screen.getByText("No materials listed for this room.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add material/ }));
    fireEvent.change(await screen.findByLabelText("Material"), { target: { value: "Grout" } });
    fireEvent.change(screen.getByLabelText("Order by (latest)"), { target: { value: "2026-05-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.insert).toHaveBeenCalledTimes(1));
    expect(h.insert.mock.calls[0][0]).toEqual({
      name: "Grout",
      quantity: 1,
      unit: "pcs",
      status: "planned",
      order_by_date: "2026-05-30",
      delivery_date: null,
      project_id: "p1",
      room_id: "r1",
    });
  });
});

describe("RoomWarnings", () => {
  const worktop = material({ id: "m1", name: "Quartz worktop", status: "planned", order_by_date: "2026-05-12" });
  const cabinets = material({ id: "m2", name: "Kitchen cabinets", status: "delivered", delivery_date: "2026-05-06" });

  it("shows an open warning to the investor with its linked materials", () => {
    wrap(
      <RoomWarnings
        projectId="p1"
        roomId="r1"
        warnings={[warning({ material_ids: ["m1", "m2"] })]}
        materials={[worktop, cabinets]}
        isManager={false}
      />,
    );
    expect(screen.getByText("Note to the investor")).toBeInTheDocument();
    expect(screen.getByText("The worktop is not ordered yet.")).toBeInTheDocument();
    expect(screen.getByText("Quartz worktop")).toBeInTheDocument();
    expect(screen.getByText("Kitchen cabinets")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("hides a warning from the investor once its linked materials are delivered, and the whole section with it", () => {
    const { container } = wrap(
      <RoomWarnings projectId="p1" roomId="r1" warnings={[warning({ material_ids: ["m2"] })]} materials={[cabinets]} isManager={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps a warning without linked materials visible", () => {
    wrap(<RoomWarnings projectId="p1" roomId="r1" warnings={[warning()]} materials={[]} isManager={false} />);
    expect(screen.getByText("The worktop is not ordered yet.")).toBeInTheDocument();
  });

  it("shows a manager every warning, marking the resolved ones", () => {
    wrap(
      <RoomWarnings
        projectId="p1"
        roomId="r1"
        warnings={[warning({ id: "w1", material_ids: ["m2"] }), warning({ id: "w2", text: "Second risk", material_ids: ["m1"] })]}
        materials={[worktop, cabinets]}
        isManager
      />,
    );
    expect(screen.getByText("The worktop is not ordered yet.")).toBeInTheDocument();
    expect(screen.getByText("Second risk")).toBeInTheDocument();
    expect(screen.getAllByText("Resolved")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Add warning" })).toBeInTheDocument();
  });

  it("lets a manager write a warning linked to a material", async () => {
    wrap(<RoomWarnings projectId="p1" roomId="r1" warnings={[]} materials={[worktop]} isManager />);
    fireEvent.click(screen.getByRole("button", { name: /Add warning/ }));
    fireEvent.change(await screen.findByLabelText("Warning"), { target: { value: "Delivery may slip" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Quartz worktop/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    // The mock's insert resolves without a row, so the warning itself is what we can observe.
    await waitFor(() => expect(h.insert).toHaveBeenCalled());
    expect(h.insert.mock.calls[0][0]).toEqual({ text: "Delivery may slip", project_id: "p1", room_id: "r1" });
  });
});

describe("RoomWorks", () => {
  const tasks = [
    task({ id: "t1", name: "Paint walls", done: true }),
    task({ id: "t2", name: "Fit sockets", in_progress: true, stage_id: "s1" }),
    task({ id: "t3", name: "Hang doors" }),
  ];
  const stages = [{ id: "s1", name: "Electrical" }];

  it("shows todo / in progress / done read-only to a client", () => {
    wrap(<RoomWorks projectId="p1" roomId="r1" tasks={tasks} stages={stages} isManager={false} />);
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("Done")).toBeInTheDocument();
    expect(within(rows[1]).getByText("In progress")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Stage: Electrical")).toBeInTheDocument();
    expect(within(rows[2]).getByText("To do")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("lets a manager change the state: it saves the done and in_progress flags", async () => {
    wrap(<RoomWorks projectId="p1" roomId="r1" tasks={tasks} stages={stages} isManager />);
    fireEvent.change(screen.getByRole("combobox", { name: 'State of "Hang doors"' }), { target: { value: "in_progress" } });
    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1));
    expect(h.update.mock.calls[0][0]).toEqual({ done: false, in_progress: true });

    fireEvent.change(screen.getByRole("combobox", { name: 'State of "Fit sockets"' }), { target: { value: "done" } });
    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(2));
    expect(h.update.mock.calls[1][0]).toEqual({ done: true, in_progress: false });
  });

  it("adds a work to the room, optionally under a stage", async () => {
    wrap(<RoomWorks projectId="p1" roomId="r1" tasks={tasks} stages={stages} isManager />);
    fireEvent.change(screen.getByLabelText("New work"), { target: { value: "Tile floor" } });
    fireEvent.change(screen.getByLabelText("Stage (optional)"), { target: { value: "s1" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(h.insert).toHaveBeenCalledTimes(1));
    expect(h.insert.mock.calls[0][0]).toEqual({ room_id: "r1", stage_id: "s1", name: "Tile floor", sort_order: 4, project_id: "p1" });
  });
});
