import type { KeyboardEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  /** Stable id (React key). */
  key: string;
  /** Header content, already translated. Use `<span className="sr-only">…</span>` for an icon-only column. */
  header: ReactNode;
  /** Cell content for one row. */
  cell: (row: T) => ReactNode;
  /** `end` right-aligns the header and cells (amounts, counts). */
  align?: "start" | "end";
  /** Layout only (width, `whitespace-nowrap`), applied to the header and every cell. */
  className?: string;
};

export type DataTableEmpty = {
  /** Material Symbols name. */
  icon?: string;
  title?: string;
  description?: string;
};

type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowKey: (row: T) => string;
  /** Makes rows clickable (and focusable: Enter/Space activate). */
  onRowClick?: (row: T) => void;
  /** Shown instead of the table when `rows` is empty. Defaults to `common:table.empty`. */
  empty?: DataTableEmpty;
  /** Footer row(s), e.g. a total: pass `<TableRow>`s from `ui/table`. */
  footer?: ReactNode;
  /** Layout only, on the `<table>` (e.g. `min-w-[720px]` so narrow screens scroll). */
  className?: string;
};

/** A list of records as a table in a card. No sorting or paging: pass rows already ordered. */
export function DataTable<T>({ rows, columns, getRowKey, onRowClick, empty, footer, className }: DataTableProps<T>) {
  if (rows.length === 0) return <DataTableEmptyState {...empty} />;

  const activate = (row: T) => (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target !== e.currentTarget) return; // a button or link inside the row handles its own keys
    e.preventDefault();
    onRowClick?.(row);
  };

  return (
    <Card>
      <Table className={className}>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={cn(col.align === "end" && "text-right", col.className)}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={getRowKey(row)}
              onClick={onRowClick && (() => onRowClick(row))}
              onKeyDown={onRowClick && activate(row)}
              tabIndex={onRowClick ? 0 : undefined}
              className={onRowClick ? "cursor-pointer" : undefined}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={cn(col.align === "end" && "text-right", col.className)}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {footer && <TableFooter>{footer}</TableFooter>}
      </Table>
    </Card>
  );
}

function DataTableEmptyState({ icon, title, description }: DataTableEmpty) {
  const { t } = useTranslation(["common"]);
  return (
    <Empty>
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon" icon={icon} />}
        <EmptyTitle>{title ?? t("common:table.empty")}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}
