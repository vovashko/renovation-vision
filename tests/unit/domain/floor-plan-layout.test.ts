import { describe, it, expect } from "vitest";
import { layoutRooms } from "@/domain/floor-plan-layout";

const W = 600;
const H = 420;
const area = (r: { w: number; h: number }) => r.w * r.h;

function assertFillsAndNoOverlap(tiles: ReturnType<typeof layoutRooms>, width: number, height: number) {
  expect(tiles.reduce((sum, r) => sum + area(r), 0)).toBeCloseTo(width * height, 4);
  for (const r of tiles) {
    expect(r.x).toBeGreaterThanOrEqual(-1e-9);
    expect(r.y).toBeGreaterThanOrEqual(-1e-9);
    expect(r.x + r.w).toBeLessThanOrEqual(width + 1e-9);
    expect(r.y + r.h).toBeLessThanOrEqual(height + 1e-9);
  }
  for (const [i, a] of tiles.entries()) {
    for (const b of tiles.slice(i + 1)) {
      const overlapW = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapH = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      expect(overlapW > 1e-6 && overlapH > 1e-6).toBe(false);
    }
  }
}

describe("layoutRooms", () => {
  it("returns nothing for no rooms", () => {
    expect(layoutRooms(0, W, H)).toEqual([]);
  });

  it("gives a single room the whole plan", () => {
    expect(layoutRooms(1, W, H)).toEqual([{ x: 0, y: 0, w: W, h: H }]);
  });

  for (let count = 1; count <= 12; count++) {
    it(`fills the plan exactly and has no overlaps for ${count} room(s)`, () => {
      assertFillsAndNoOverlap(layoutRooms(count, W, H), W, H);
    });

    it(`is stable for ${count} room(s)`, () => {
      expect(layoutRooms(count, W, H)).toEqual(layoutRooms(count, W, H));
    });
  }

  it("2 rooms split the plan in half", () => {
    const [a, b] = layoutRooms(2, W, H);
    expect(a).toEqual({ x: 0, y: 0, w: W / 2, h: H });
    expect(b).toEqual({ x: W / 2, y: 0, w: W / 2, h: H });
  });

  it("3 rooms sit side by side", () => {
    const tiles = layoutRooms(3, W, H);
    expect(tiles).toHaveLength(3);
    expect(tiles.every((t) => t.h === H)).toBe(true);
  });

  it("4 rooms form a 2x2 grid", () => {
    const tiles = layoutRooms(4, W, H);
    expect(tiles).toHaveLength(4);
    expect(new Set(tiles.map((t) => t.w)).size).toBe(1);
    expect(new Set(tiles.map((t) => t.h)).size).toBe(1);
  });

  it("the last, shorter row stretches to fill the width", () => {
    // 7 rooms: two rows of 3 and a final row of 1, which should be as wide as the plan.
    const tiles = layoutRooms(7, W, H);
    const last = tiles[6];
    expect(last.w).toBeCloseTo(W, 6);
  });

  it("uses a single column of equal tiles on a narrow container", () => {
    const tiles = layoutRooms(3, 300, 900);
    expect(tiles).toHaveLength(3);
    for (const t of tiles) expect(t.w).toBe(300);
    expect(new Set(tiles.map((t) => t.h)).size).toBe(1);
    assertFillsAndNoOverlap(tiles, 300, 900);
  });
});
