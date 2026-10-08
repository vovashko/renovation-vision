-- Rooms no longer carry a position on the plan. The app lays the rooms out itself from their real dimensions
-- (see src/domain/floor-plan-layout.ts), so only the width and length stay, now in metres.
-- Existing values were plan units (600 across ≈ 15 m): 40 units per metre keeps every room's proportions.

alter table public.rooms drop column x, drop column y;

alter table public.rooms alter column w drop default, alter column h drop default;
alter table public.rooms
  alter column w type numeric(5, 2) using round(w / 40.0, 2),
  alter column h type numeric(5, 2) using round(h / 40.0, 2);
alter table public.rooms alter column w set default 4, alter column h set default 3;

comment on column public.rooms.w is 'Room width in metres (the plan lays rooms out proportionally to w × h).';
comment on column public.rooms.h is 'Room length in metres (the plan lays rooms out proportionally to w × h).';
