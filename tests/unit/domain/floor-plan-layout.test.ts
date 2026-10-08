import { describe, it, expect } from "vitest";
import { layoutRooms } from "@/domain/floor-plan-layout";

const W = 600;
const H = 420;
const area = (r: { w: number; h: number }) => r.w * r.h;

describe("layoutRooms", () => {
  it("returns nothing for no rooms", () => {
    expect(layoutRooms([], W, H).size).toBe(0);
  });

  it("gives a single room the whole plan", () => {
    const r = layoutRooms([{ id: "a", w: 4, h: 3 }], W, H).get("a");
    expect(r).toEqual({ x: 0, y: 0, w: W, h: H });
  });

  it("fills the plan exactly and keeps every tile inside it", () => {
    const rooms = [
      { id: "living", w: 8, h: 5.5 },
      { id: "kitchen", w: 6, h: 3.5 },
      { id: "dining", w: 6, h: 2 },
      { id: "bath", w: 4, h: 4 },
      { id: "bed1", w: 5, h: 4 },
      { id: "bed2", w: 5, h: 4 },
    ];
    const layout = layoutRooms(rooms, W, H);
    expect([...layout.values()].reduce((sum, r) => sum + area(r), 0)).toBeCloseTo(W * H, 4);
    for (const r of layout.values()) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(W + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(H + 1e-9);
    }
  });

  it("sizes tiles in proportion to real area, so the biggest room takes the most space", () => {
    const rooms = [
      { id: "small", w: 2, h: 2 },
      { id: "big", w: 6, h: 4 },
      { id: "mid", w: 4, h: 3 },
    ];
    const layout = layoutRooms(rooms, W, H);
    const ratio = (id: string, other: string) => area(layout.get(id)!) / area(layout.get(other)!);
    expect(ratio("big", "small")).toBeCloseTo(6, 6);
    expect(ratio("mid", "small")).toBeCloseTo(3, 6);
    expect(area(layout.get("big")!)).toBeGreaterThan(area(layout.get("mid")!));
  });

  it("does not overlap tiles", () => {
    const rooms = Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, w: 2 + i, h: 3 }));
    const tiles = [...layoutRooms(rooms, W, H).values()];
    for (const [i, a] of tiles.entries()) {
      for (const b of tiles.slice(i + 1)) {
        const overlapW = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapH = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(overlapW > 1e-6 && overlapH > 1e-6).toBe(false);
      }
    }
  });
});
