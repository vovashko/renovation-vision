-- Activity log labels for the W4 tables, room warnings and documents, and the materials -> progress_entries link.
begin;

do $$
declare
  v_project uuid; v_stage uuid; v_stage_name text; v_entry uuid; v_material uuid;
  v_params jsonb; v_entity_id uuid; v_fk uuid;
begin
  select id into v_project from public.projects order by created_at limit 1;
  select id, name into v_stage, v_stage_name from public.stages where project_id = v_project order by sort_order limit 1;

  -- Diary entry: entity diary_entry, labelled by its note.
  insert into public.progress_entries (project_id, stage_id, note)
  values (v_project, v_stage, 'Activity label test entry') returning id into v_entry;
  select params into v_params from public.activity_log where entity_type = 'progress_entries' order by id desc limit 1;
  if v_params ->> 'entity' is distinct from 'diary_entry' or v_params ->> 'label' is distinct from 'Activity label test entry' then
    raise exception 'FAILED: diary entry params = %', v_params;
  end if;

  -- Material: entity material, labelled by its name; linked to the diary entry.
  insert into public.materials (project_id, stage_id, name, progress_entry_id)
  values (v_project, v_stage, 'Label test tiles', v_entry) returning id into v_material;
  select params into v_params from public.activity_log where entity_type = 'materials' order by id desc limit 1;
  if v_params ->> 'entity' is distinct from 'material' or v_params ->> 'label' is distinct from 'Label test tiles' then
    raise exception 'FAILED: material params = %', v_params;
  end if;

  -- Stage budget: entity stage_budget, labelled by the stage name, entity_id = the stage.
  update public.stage_budgets set planned_cost = planned_cost + 1 where stage_id = v_stage;
  select params, entity_id into v_params, v_entity_id from public.activity_log where entity_type = 'stage_budgets' order by id desc limit 1;
  if v_params ->> 'entity' is distinct from 'stage_budget' or v_params ->> 'label' is distinct from left(v_stage_name, 80) then
    raise exception 'FAILED: stage budget params = %', v_params;
  end if;
  if v_entity_id is distinct from v_stage then
    raise exception 'FAILED: stage budget entity_id = %, expected the stage %', v_entity_id, v_stage;
  end if;

  -- Room warning: entity room_warning, labelled by the start of its text.
  insert into public.room_warnings (project_id, room_id, text)
  select v_project, r.id, 'Label test warning' from public.rooms r where r.project_id = v_project order by r.sort_order limit 1;
  select params into v_params from public.activity_log where entity_type = 'room_warnings' order by id desc limit 1;
  if v_params ->> 'entity' is distinct from 'room_warning' or v_params ->> 'label' is distinct from 'Label test warning' then
    raise exception 'FAILED: room warning params = %', v_params;
  end if;

  -- Document: entity document, labelled by its file name.
  insert into public.documents (project_id, category, storage_path, file_name, mime_type, size_bytes)
  values (v_project, 'contract', v_project || '/contract/label-test.pdf', 'Umowa label test.pdf', 'application/pdf', 1000);
  select params into v_params from public.activity_log where entity_type = 'documents' order by id desc limit 1;
  if v_params ->> 'entity' is distinct from 'document' or v_params ->> 'label' is distinct from 'Umowa label test.pdf' then
    raise exception 'FAILED: document params = %', v_params;
  end if;

  -- FK: a material can't point at a missing entry, and deleting the entry clears the link.
  begin
    update public.materials set progress_entry_id = gen_random_uuid() where id = v_material;
    raise exception 'FAILED: materials.progress_entry_id accepted a missing entry';
  exception when foreign_key_violation then null;
  end;
  delete from public.progress_entries where id = v_entry;
  select progress_entry_id into v_fk from public.materials where id = v_material;
  if v_fk is not null then
    raise exception 'FAILED: deleting the diary entry did not clear materials.progress_entry_id';
  end if;
end $$;

select 'activity label tests passed';
rollback;
