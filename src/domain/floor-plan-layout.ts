// Floor-plan layout. The plan is a visual aid, not a scale drawing: rooms are arranged in a fixed grid by
// count, in the order they're given (callers sort by `sort_order`, then `created_at`). Each room's real
// width and length (metres) stay in the room form and the room view, but the layout ignores them —
// previous versions sized tiles by real area; that's gone. Pure: no React, no I/O.

export type PlanRect = { x: number; y: number; w: number; h: number };

/** Columns/rows for a tile grid of `count` rooms, on a plan at least as wide as it is tall. */
function gridShape(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count === 3) return { cols: 3, rows: 1 };
  if (count === 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  return { cols: 4, rows: Math.ceil(count / 4) };
}

/**
 * Fixed layout by room count — a visual aid, not sized from the rooms' real dimensions: 1 room fills the
 * plan, 2 split it, 3 sit side by side, 4 form a 2×2 grid, 5-6 a 3×2 grid, 7-9 a 3×3 grid, then 4 columns.
 * The last row stretches to fill the width when it has fewer tiles than the others. On a narrow container
 * (taller than wide), every room gets an equal-height row in a single column instead.
 * Returns one rect per room, in the input order, each exactly `width × height` in total.
 */
export function layoutRooms(count: number, width: number, height: number): PlanRect[] {
  if (count <= 0) return [];

  if (width < height) {
    const h = height / count;
    return Array.from({ length: count }, (_, i) => ({ x: 0, y: i * h, w: width, h }));
  }

  const { cols, rows } = gridShape(count);
  const rowH = height / rows;
  const fullRows = Math.floor(count / cols);
  const lastRowCount = count - fullRows * cols || cols;

  const out: PlanRect[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const isLastRow = row === rows - 1;
    const itemsInRow = isLastRow ? lastRowCount : cols;
    const colInRow = i - row * cols;
    const tileW = width / itemsInRow;
    out.push({ x: colInRow * tileW, y: row * rowH, w: tileW, h: rowH });
  }
  return out;
}
