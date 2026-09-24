import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { initialPhotos, PROJECT_TODAY, type SitePhoto } from "@/lib/media-data";

/**
 * Photo store. Currently in-memory; swap `addPhotos` for a real upload
 * (storage + database insert) without changing consumers.
 */
type PhotoStore = {
  photos: SitePhoto[];
  addPhotos: (files: File[], meta: { stageId: string; roomId: string; caption: string }) => Promise<void>;
};

const Ctx = createContext<PhotoStore | null>(null);

export function PhotoProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<SitePhoto[]>(initialPhotos);

  const addPhotos = useCallback<PhotoStore["addPhotos"]>(async (files, meta) => {
    const now = new Date();
    const stamp = new Date(PROJECT_TODAY);
    stamp.setHours(now.getHours(), now.getMinutes());
    const created: SitePhoto[] = files.map((f, i) => ({
      id: `u-${Date.now()}-${i}`,
      src: URL.createObjectURL(f),
      alt: meta.caption || f.name,
      caption: meta.caption || "New site photo",
      stageId: meta.stageId,
      roomId: meta.roomId,
      takenAt: stamp.toISOString(),
      uploadedBy: "Jonas Weber",
    }));
    setPhotos((p) => [...created, ...p]);
  }, []);

  const value = useMemo(() => ({ photos, addPhotos }), [photos, addPhotos]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePhotos() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePhotos must be used inside PhotoProvider");
  const sorted = [...c.photos].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  return { photos: sorted, addPhotos: c.addPhotos };
}
