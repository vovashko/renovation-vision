export type Status = "done" | "progress" | "pending" | "blocked";

export const statusLabel: Record<Status, string> = {
  done: "Completed",
  progress: "In progress",
  pending: "Pending",
  blocked: "Blocked",
};

export const statusColor: Record<Status, string> = {
  done: "bg-status-done",
  progress: "bg-status-progress",
  pending: "bg-status-pending",
  blocked: "bg-status-blocked",
};

export const statusFill: Record<Status, string> = {
  done: "var(--status-done)",
  progress: "var(--status-progress)",
  pending: "var(--status-pending)",
  blocked: "var(--status-blocked)",
};

export type Stage = {
  id: string;
  name: string;
  status: Status;
  progress: number;
  start: string;
  end: string;
  tasks: { name: string; done: boolean }[];
};

export const stages: Stage[] = [
  {
    id: "demo",
    name: "Demolition",
    status: "done",
    progress: 100,
    start: "Mar 02",
    end: "Mar 14",
    tasks: [
      { name: "Remove old flooring", done: true },
      { name: "Tear down partition wall", done: true },
      { name: "Dispose debris", done: true },
    ],
  },
  {
    id: "elec",
    name: "Electrical & Plumbing",
    status: "done",
    progress: 100,
    start: "Mar 15",
    end: "Apr 02",
    tasks: [
      { name: "New circuit panel", done: true },
      { name: "Re-route bathroom plumbing", done: true },
      { name: "Inspection sign-off", done: true },
    ],
  },
  {
    id: "wall",
    name: "Walls & Insulation",
    status: "progress",
    progress: 65,
    start: "Apr 03",
    end: "Apr 24",
    tasks: [
      { name: "Drywall living room", done: true },
      { name: "Insulate exterior walls", done: true },
      { name: "Tape & mud", done: false },
      { name: "Prime walls", done: false },
    ],
  },
  {
    id: "floor",
    name: "Flooring",
    status: "progress",
    progress: 20,
    start: "Apr 18",
    end: "May 08",
    tasks: [
      { name: "Subfloor leveling", done: true },
      { name: "Install oak planks", done: false },
      { name: "Bathroom tiling", done: false },
    ],
  },
  {
    id: "kitch",
    name: "Kitchen Install",
    status: "pending",
    progress: 0,
    start: "May 09",
    end: "May 22",
    tasks: [
      { name: "Cabinet delivery", done: false },
      { name: "Countertop template", done: false },
      { name: "Appliance hookup", done: false },
    ],
  },
  {
    id: "paint",
    name: "Painting & Finishes",
    status: "pending",
    progress: 0,
    start: "May 23",
    end: "Jun 05",
    tasks: [
      { name: "Ceiling paint", done: false },
      { name: "Wall color coats", done: false },
      { name: "Trim & doors", done: false },
    ],
  },
  {
    id: "final",
    name: "Final Inspection",
    status: "pending",
    progress: 0,
    start: "Jun 06",
    end: "Jun 10",
    tasks: [{ name: "Walkthrough with client", done: false }],
  },
];

export type Room = {
  id: string;
  name: string;
  status: Status;
  progress: number;
  // SVG rect coords on a 600x420 viewBox
  x: number;
  y: number;
  w: number;
  h: number;
};

export const rooms: Room[] = [
  { id: "living", name: "Living Room", status: "progress", progress: 60, x: 20, y: 20, w: 320, h: 220 },
  { id: "kitchen", name: "Kitchen", status: "pending", progress: 10, x: 340, y: 20, w: 240, h: 140 },
  { id: "dining", name: "Dining", status: "progress", progress: 45, x: 340, y: 160, w: 240, h: 80 },
  { id: "bath", name: "Bathroom", status: "done", progress: 100, x: 20, y: 240, w: 160, h: 160 },
  { id: "bed1", name: "Bedroom 1", status: "progress", progress: 35, x: 180, y: 240, w: 200, h: 160 },
  { id: "bed2", name: "Bedroom 2", status: "blocked", progress: 15, x: 380, y: 240, w: 200, h: 160 },
];

export const project = {
  name: "Maple Street Apartment",
  address: "42 Maple Street, Apt 5B",
  client: "Sarah & Tom Bennett",
  manager: "Jonas Weber",
  startDate: "Mar 02, 2026",
  targetDate: "Jun 10, 2026",
  budget: 84500,
  spent: 51200,
};

export function overallProgress() {
  return Math.round(stages.reduce((s, x) => s + x.progress, 0) / stages.length);
}
