-- T60: the project's health is derived from its stages and rooms, so the manual schedule status no
-- longer notifies anyone. Stage and room changes still notify through notify_stage / notify_room.
-- The schedule_status column stays (the summary views read it); T50 drops it with the other cleanups.
drop trigger if exists notify_schedule on public.projects;
