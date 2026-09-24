import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rooms, stages } from "@/lib/renovation-data";
import { usePhotos } from "@/lib/photo-store";
import { useIsMobile } from "@/hooks/use-mobile";

const selectCls = "h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PhotoUploadSheet() {
  const { addPhotos } = usePhotos();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [stageId, setStageId] = useState(stages.find((s) => s.status === "progress")?.id ?? stages[0].id);
  const [roomId, setRoomId] = useState(rooms[0].id);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!files.length) return;
    setSaving(true);
    await addPhotos(files, { stageId, roomId, caption: caption.trim() });
    setSaving(false);
    setFiles([]); setCaption(""); setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="min-h-11 gap-2"><ImagePlus className="h-4 w-4" /> Add photos</Button>
      </SheetTrigger>
      <SheetContent side={isMobile ? "bottom" : "right"} className="max-h-[90dvh] overflow-y-auto rounded-t-2xl md:rounded-none">
        <SheetHeader>
          <SheetTitle>Add site photos</SheetTitle>
          <SheetDescription>Share progress with the client. Tag the stage and room.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="photo-files">Images</Label>
            <input id="photo-files" type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-muted file:px-4 file:text-sm file:font-medium" />
            {files.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {files.map((f) => (
                  <img key={f.name} src={URL.createObjectURL(f)} alt={f.name} className="aspect-square w-full rounded-md object-cover" />
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="photo-stage">Stage</Label>
            <select id="photo-stage" value={stageId} onChange={(e) => setStageId(e.target.value)} className={selectCls}>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="photo-room">Room</Label>
            <select id="photo-room" value={roomId} onChange={(e) => setRoomId(e.target.value)} className={selectCls}>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="photo-caption">Caption</Label>
            <Textarea id="photo-caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What changed today?" />
          </div>
          <Button onClick={submit} disabled={!files.length || saving} className="min-h-11 w-full">
            {saving ? "Uploading…" : `Upload ${files.length || ""} photo${files.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
