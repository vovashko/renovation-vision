import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "@/shared/ui/data-table";

type Row = { id: string; name: string; amount: number };

const rows: Row[] = [
  { id: "a", name: "Tiles", amount: 120 },
  { id: "b", name: "Grout", amount: 15 },
];

const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "Item", cell: (r) => r.name },
  { key: "amount", header: "Amount", cell: (r) => r.amount.toFixed(2), align: "end" },
];

describe("DataTable", () => {
  it("renders a header per column and a row per record", () => {
    render(<DataTable rows={rows} columns={columns} getRowKey={(r) => r.id} />);
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Item", "Amount"]);
    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(bodyRows).toHaveLength(2);
    expect(
      within(bodyRows[0])
        .getAllByRole("cell")
        .map((td) => td.textContent),
    ).toEqual(["Tiles", "120.00"]);
  });

  it("right-aligns `align: end` columns", () => {
    render(<DataTable rows={rows} columns={columns} getRowKey={(r) => r.id} />);
    expect(screen.getByRole("columnheader", { name: "Amount" })).toHaveClass("text-right");
    expect(screen.getByRole("cell", { name: "15.00" })).toHaveClass("text-right");
  });

  it("shows the default empty state when there are no rows", () => {
    render(<DataTable rows={[]} columns={columns} getRowKey={(r) => r.id} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No rows yet" })).toBeInTheDocument();
  });

  it("shows a custom empty state", () => {
    render(
      <DataTable
        rows={[]}
        columns={columns}
        getRowKey={(r) => r.id}
        empty={{ icon: "receipt_long", title: "No expenses yet", description: "Add the first one." }}
      />,
    );
    expect(screen.getByRole("heading", { name: "No expenses yet" })).toBeInTheDocument();
    expect(screen.getByText("Add the first one.")).toBeInTheDocument();
  });

  it("calls onRowClick with the row, by click or Enter", () => {
    const onRowClick = vi.fn();
    render(<DataTable rows={rows} columns={columns} getRowKey={(r) => r.id} onRowClick={onRowClick} />);
    const [, first, second] = screen.getAllByRole("row");
    fireEvent.click(second);
    expect(onRowClick).toHaveBeenLastCalledWith(rows[1]);
    fireEvent.keyDown(first, { key: "Enter" });
    expect(onRowClick).toHaveBeenLastCalledWith(rows[0]);
    expect(first).toHaveAttribute("tabindex", "0");
  });

  it("leaves rows inert without onRowClick", () => {
    render(<DataTable rows={rows} columns={columns} getRowKey={(r) => r.id} />);
    expect(screen.getAllByRole("row")[1]).not.toHaveAttribute("tabindex");
  });
});
