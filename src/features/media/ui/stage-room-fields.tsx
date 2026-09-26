import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Room, Stage } from "@/lib/database.types";

/** Stage + room pickers, side by side, shared by the upload sheet and the photo edit sheet. */
export function StageRoomFields({
  prefix,
  stages,
  rooms,
  stageId,
  roomId,
  onStage,
  onRoom,
}: {
  prefix: string;
  stages: Stage[];
  rooms: Room[];
  stageId: string;
  roomId: string;
  onStage: (v: string) => void;
  onRoom: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field>
        <FieldLabel htmlFor={`${prefix}-stage`}>Stage</FieldLabel>
        <NativeSelect id={`${prefix}-stage`} value={stageId} onChange={(e) => onStage(e.target.value)}>
          <NativeSelectOption value="">—</NativeSelectOption>
          {stages.map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>
              {s.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-room`}>Room</FieldLabel>
        <NativeSelect id={`${prefix}-room`} value={roomId} onChange={(e) => onRoom(e.target.value)}>
          <NativeSelectOption value="">—</NativeSelectOption>
          {rooms.map((r) => (
            <NativeSelectOption key={r.id} value={r.id}>
              {r.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}
