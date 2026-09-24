import photoDemo from "@/assets/photo-demo.jpg";
import photoDemo2 from "@/assets/photo-demo-2.jpg";
import photoWiring from "@/assets/photo-wiring.jpg";
import photoWiring2 from "@/assets/photo-wiring-2.jpg";
import photoDrywall from "@/assets/photo-drywall.jpg";
import photoDrywall2 from "@/assets/photo-drywall-2.jpg";
import photoFlooring from "@/assets/photo-flooring.jpg";
import photoFlooring2 from "@/assets/photo-flooring-2.jpg";
import renderLiving from "@/assets/render-living.jpg";
import renderKitchen from "@/assets/render-kitchen.jpg";
import renderBath from "@/assets/render-bath.jpg";
import renderBedroom from "@/assets/render-bedroom.jpg";

/** The demo project's "today" — keeps mock dates consistent with stage progress. */
export const PROJECT_TODAY = new Date("2026-04-20T12:00:00");

export type SitePhoto = {
  id: string;
  src: string;
  alt: string;
  caption: string;
  stageId: string;
  roomId: string;
  takenAt: string; // ISO
  uploadedBy: string;
};

export const initialPhotos: SitePhoto[] = [
  {
    id: "p1",
    src: photoDrywall,
    alt: "Living room with fresh drywall panels and taped seams",
    caption: "Drywall finished in the living room — taping started this morning.",
    stageId: "wall",
    roomId: "living",
    takenAt: "2026-04-20T10:12:00",
    uploadedBy: "Jonas Weber",
  },
  {
    id: "p2",
    src: photoFlooring,
    alt: "Bedroom subfloor freshly leveled with oak planks stacked nearby",
    caption: "Subfloor leveled in Bedroom 1. Oak planks acclimatising before install.",
    stageId: "floor",
    roomId: "bed1",
    takenAt: "2026-04-20T08:40:00",
    uploadedBy: "Jonas Weber",
  },
  {
    id: "p3",
    src: photoDrywall2,
    alt: "Dining area walls boarded with drywall",
    caption: "Dining walls boarded and insulated behind the panels.",
    stageId: "wall",
    roomId: "dining",
    takenAt: "2026-04-19T16:05:00",
    uploadedBy: "Jonas Weber",
  },
  {
    id: "p4",
    src: photoFlooring2,
    alt: "Self-leveling compound drying on a bedroom floor",
    caption: "Levelling compound curing — ready for planks in 48h.",
    stageId: "floor",
    roomId: "bed1",
    takenAt: "2026-04-19T11:30:00",
    uploadedBy: "Jonas Weber",
  },
  {
    id: "p5",
    src: photoWiring,
    alt: "Open stud wall in Bedroom 2 with new wiring awaiting inspection",
    caption: "Bedroom 2 walls stay open until the electrical inspector signs off the new circuit.",
    stageId: "wall",
    roomId: "bed2",
    takenAt: "2026-04-17T14:20:00",
    uploadedBy: "Jonas Weber",
  },
  {
    id: "p6",
    src: photoWiring2,
    alt: "New circuit panel installed between wooden studs",
    caption: "New circuit panel installed and labelled.",
    stageId: "elec",
    roomId: "kitchen",
    takenAt: "2026-03-28T09:50:00",
    uploadedBy: "Jonas Weber",
  },
  {
    id: "p7",
    src: photoDemo,
    alt: "Living room during demolition with old flooring torn up",
    caption: "Partition wall removed — living and dining now open plan.",
    stageId: "demo",
    roomId: "living",
    takenAt: "2026-03-10T15:00:00",
    uploadedBy: "Jonas Weber",
  },
  {
    id: "p8",
    src: photoDemo2,
    alt: "Old flooring pieces scattered across the dining area",
    caption: "Old flooring lifted in the dining area.",
    stageId: "demo",
    roomId: "dining",
    takenAt: "2026-03-06T10:00:00",
    uploadedBy: "Jonas Weber",
  },
];

export type Render = {
  id: string;
  roomId: string;
  src: string;
  alt: string;
  title: string;
  description: string;
};

export const renders: Render[] = [
  {
    id: "r1",
    roomId: "living",
    src: renderLiving,
    alt: "Render of the finished living room with oak floors and linen sofa",
    title: "Open living space",
    description: "Oak plank floors, soft white walls, linen sofa with terracotta accents.",
  },
  {
    id: "r2",
    roomId: "kitchen",
    src: renderKitchen,
    alt: "Render of the finished kitchen with matte white cabinets",
    title: "Kitchen & island",
    description: "Matte white cabinets, oak open shelving, quartz worktops, brass fixtures.",
  },
  {
    id: "r3",
    roomId: "bath",
    src: renderBath,
    alt: "Render of the finished bathroom with sage green tiles",
    title: "Bathroom",
    description: "Sage zellige tiles, walk-in shower, oak vanity, matte black taps.",
  },
  {
    id: "r4",
    roomId: "bed1",
    src: renderBedroom,
    alt: "Render of the finished bedroom with oak floor and warm beige walls",
    title: "Bedroom 1",
    description: "Oak floor, warm beige walls, linen bedding, restored radiator.",
  },
];

/** Before/after pair: current site photo vs. planned render. */
export const beforeAfter = { roomId: "living", before: photoDrywall, after: renderLiving };

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(PROJECT_TODAY) - day(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
