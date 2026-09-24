import { rooms, stages } from "@/lib/renovation-data";
import { dayLabel, timeLabel, type SitePhoto } from "@/lib/media-data";
import type { LightboxItem } from "@/components/lightbox";

export const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? id;
export const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? id;

export function toLightbox(p: SitePhoto): LightboxItem {
  return {
    src: p.src,
    alt: p.alt,
    title: p.caption,
    subtitle: `${dayLabel(p.takenAt)}, ${timeLabel(p.takenAt)} · ${p.uploadedBy}`,
    tags: [stageName(p.stageId), roomName(p.roomId)],
  };
}
