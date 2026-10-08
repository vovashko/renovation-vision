// Floor-plan layout. Rooms carry only their real dimensions (width × length); where each one sits on the plan
// is computed here, so nobody has to place rooms by hand. Pure: no React, no I/O.

export type PlanRect = { x: number; y: number; w: number; h: number };

type Sized = { id: string; w: number; h: number };

/** Worst aspect ratio in `row` if it were laid along a side of length `side` (areas already scaled to the plan). */
function worstRatio(areas: number[], side: number): number {
  const sum = areas.reduce((a, b) => a + b, 0);
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

/**
 * Squarified treemap: every room gets a tile whose area is proportional to its real area (width × length), and
 * the tiles together fill `width × height` exactly. The biggest room takes the most space; ties keep input order.
 * Returns a rect per room id, in plan units.
 */
export function layoutRooms(rooms: Sized[], width: number, height: number): Map<string, PlanRect> {
  const out = new Map<string, PlanRect>();
  if (rooms.length === 0) return out;

  const real = rooms.map((r) => ({ id: r.id, area: Math.max(r.w, 0.01) * Math.max(r.h, 0.01) }));
  const total = real.reduce((sum, r) => sum + r.area, 0);
  const scale = (width * height) / total;
  const items = real.map((r, i) => ({ id: r.id, area: r.area * scale, i })).sort((a, b) => b.area - a.area || a.i - b.i);

  let free: PlanRect = { x: 0, y: 0, w: width, h: height };
  let row: typeof items = [];

  const flush = () => {
    if (row.length === 0) return;
    const sum = row.reduce((a, r) => a + r.area, 0);
    if (free.w >= free.h) {
      // Wide space: the row is a column on the left, rooms stacked top to bottom.
      const colW = sum / free.h;
      let y = free.y;
      for (const r of row) {
        const h = r.area / colW;
        out.set(r.id, { x: free.x, y, w: colW, h });
        y += h;
      }
      free = { x: free.x + colW, y: free.y, w: free.w - colW, h: free.h };
    } else {
      // Tall space: the row runs along the top, rooms left to right.
      const rowH = sum / free.w;
      let x = free.x;
      for (const r of row) {
        const w = r.area / rowH;
        out.set(r.id, { x, y: free.y, w, h: rowH });
        x += w;
      }
      free = { x: free.x, y: free.y + rowH, w: free.w, h: free.h - rowH };
    }
    row = [];
  };

  for (const item of items) {
    const side = Math.min(free.w, free.h);
    if (
      row.length === 0 ||
      worstRatio(
        [...row, item].map((r) => r.area),
        side,
      ) <=
        worstRatio(
          row.map((r) => r.area),
          side,
        )
    ) {
      row.push(item);
    } else {
      flush();
      row.push(item);
    }
  }
  flush();
  return out;
}
