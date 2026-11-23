-- Contacts import (T46): public.import_contacts(p_rows), the third all-or-nothing import RPC beside
-- import_stages and import_materials (T45's wizard calls it through a staff-only server function).
--
-- Who: staff (private.is_staff()) with an MFA-verified session while 2FA is enforced, like every other
-- write to contacts. The function is security definer, so it checks both itself.
--
-- Rows: [{ full_name, kind?, company?, trade?, phone?, whatsapp?, email?, notes? }]
--   kind      client | crew | supplier | architect | other (blank = other)
--   phone     E.164 once spaces, dashes, dots and brackets are removed ("+48 600 100 200" is fine); stored
--   whatsapp  without the separators ("+48600100200"), so wa.me links work. The browser adds +48 to a bare
--             9-digit Polish number before it gets here; this function never guesses a country.
--   email     normalized the way contacts do it (lower case, trimmed)
--
-- Dedupe rule (rows are matched against the address book):
--   * a row WITH an email matches the existing contact with that email (case-insensitive). The contact keeps
--     its name, kind and every value it already has; only its EMPTY company, trade, phone, whatsapp and notes
--     are filled in from the row. Nothing is overwritten, so a re-import is safe and a typo in a sheet can't
--     damage a good contact. A match that adds nothing is counted as skipped.
--   * a row WITHOUT an email matches an existing contact with the same name (case-insensitive) and the same
--     phone digits; it is skipped. Without a phone it can't be matched and is added as a new contact.
--   * the same email twice in one file is an error on the second row (duplicate_in_file): the sheet is
--     ambiguous and nothing is saved.
--
-- Returns { inserted, updated, skipped }. Invalid input raises 22023 with message 'import_contacts: invalid
-- rows' and DETAIL = a JSON array of { row (0-based index in p_rows), field, code }, like import_stages.
-- Codes: required | too_long | invalid_kind | invalid_phone | invalid_whatsapp | invalid_email |
--        duplicate_in_file | not_an_object

create or replace function public.import_contacts(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_errors jsonb := '[]'::jsonb;
  v_row jsonb;
  v_i int;
  v_name text;
  v_kind public.contact_kind;
  v_kind_text text;
  v_company text;
  v_trade text;
  v_phone text;
  v_whatsapp text;
  v_email text;
  v_notes text;
  v_seen text[] := '{}';
  v_existing public.contacts;
  v_inserted int := 0;
  v_updated int := 0;
  v_skipped int := 0;
begin
  if not private.is_staff() then
    raise exception 'Only staff can import contacts' using errcode = '42501';
  end if;
  if not private.staff_mfa_ok() then
    raise exception 'Two-factor verification required' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'import_contacts: rows must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'import_contacts: at most 1000 rows at a time' using errcode = '22023';
  end if;

  -- Validate every row first.
  for v_i in 0 .. jsonb_array_length(p_rows) - 1 loop
    v_row := p_rows -> v_i;
    if jsonb_typeof(v_row) <> 'object' then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', null, 'code', 'not_an_object');
      continue;
    end if;

    v_name := btrim(coalesce(v_row ->> 'full_name', ''));
    if v_name = '' then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'full_name', 'code', 'required');
    elsif length(v_name) > 160 then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'full_name', 'code', 'too_long');
    end if;

    v_kind_text := lower(btrim(coalesce(v_row ->> 'kind', '')));
    if v_kind_text <> '' and v_kind_text not in ('client', 'crew', 'supplier', 'architect', 'other') then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'kind', 'code', 'invalid_kind');
    end if;

    if length(btrim(coalesce(v_row ->> 'company', ''))) > 160 then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'company', 'code', 'too_long');
    end if;
    if length(btrim(coalesce(v_row ->> 'trade', ''))) > 120 then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'trade', 'code', 'too_long');
    end if;
    if length(btrim(coalesce(v_row ->> 'notes', ''))) > 2000 then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'notes', 'code', 'too_long');
    end if;

    v_phone := regexp_replace(coalesce(v_row ->> 'phone', ''), '[\s().-]', '', 'g');
    if v_phone <> '' and v_phone !~ '^\+[1-9][0-9]{6,14}$' then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'phone', 'code', 'invalid_phone');
    end if;
    v_whatsapp := regexp_replace(coalesce(v_row ->> 'whatsapp', ''), '[\s().-]', '', 'g');
    if v_whatsapp <> '' and v_whatsapp !~ '^\+[1-9][0-9]{6,14}$' then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'whatsapp', 'code', 'invalid_whatsapp');
    end if;

    v_email := lower(btrim(coalesce(v_row ->> 'email', '')));
    if v_email <> '' then
      if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'email', 'code', 'invalid_email');
      elsif v_email = any (v_seen) then
        v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'email', 'code', 'duplicate_in_file');
      else
        v_seen := v_seen || v_email;
      end if;
    end if;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    raise exception 'import_contacts: invalid rows' using errcode = '22023', detail = v_errors::text;
  end if;

  -- Write: add, fill in blanks, or skip.
  for v_i in 0 .. jsonb_array_length(p_rows) - 1 loop
    v_row := p_rows -> v_i;
    v_name := btrim(v_row ->> 'full_name');
    v_kind := coalesce(nullif(lower(btrim(coalesce(v_row ->> 'kind', ''))), ''), 'other')::public.contact_kind;
    v_company := nullif(btrim(coalesce(v_row ->> 'company', '')), '');
    v_trade := nullif(btrim(coalesce(v_row ->> 'trade', '')), '');
    v_notes := nullif(btrim(coalesce(v_row ->> 'notes', '')), '');
    v_phone := nullif(regexp_replace(coalesce(v_row ->> 'phone', ''), '[\s().-]', '', 'g'), '');
    v_whatsapp := nullif(regexp_replace(coalesce(v_row ->> 'whatsapp', ''), '[\s().-]', '', 'g'), '');
    v_email := nullif(lower(btrim(coalesce(v_row ->> 'email', ''))), '');

    v_existing := null;
    if v_email is not null then
      select c.* into v_existing from public.contacts c
      where lower(c.email) = v_email
      order by (c.kind = 'client') desc, c.created_at
      limit 1;
    elsif v_phone is not null then
      select c.* into v_existing from public.contacts c
      where lower(btrim(c.full_name)) = lower(v_name)
        and regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') = regexp_replace(v_phone, '[^0-9]', '', 'g')
      order by c.created_at
      limit 1;
    end if;

    if v_existing.id is null then
      insert into public.contacts (kind, full_name, company, trade, phone, whatsapp, email, notes)
      values (v_kind, v_name, v_company, v_trade, v_phone, v_whatsapp, v_email, v_notes);
      v_inserted := v_inserted + 1;
    elsif v_email is null then
      v_skipped := v_skipped + 1;
    elsif (v_existing.company is null and v_company is not null)
       or (v_existing.trade is null and v_trade is not null)
       or (v_existing.phone is null and v_phone is not null)
       or (v_existing.whatsapp is null and v_whatsapp is not null)
       or (v_existing.notes is null and v_notes is not null) then
      update public.contacts c set
        company = coalesce(c.company, v_company),
        trade = coalesce(c.trade, v_trade),
        phone = coalesce(c.phone, v_phone),
        whatsapp = coalesce(c.whatsapp, v_whatsapp),
        notes = coalesce(c.notes, v_notes)
      where c.id = v_existing.id;
      v_updated := v_updated + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'skipped', v_skipped);
end;
$$;

comment on function public.import_contacts(jsonb) is
  'Staff: add contacts to the address book, all or nothing. Rows: [{ full_name, kind?, company?, trade?, phone? '
  '(E.164), whatsapp? (E.164), email?, notes? }]. An existing contact with the same email only has its empty '
  'fields filled in (never overwritten); a row without an email is skipped when the same name and phone exist. '
  'Returns { inserted, updated, skipped }; invalid input raises 22023 with DETAIL = JSON array of { row, field, code }.';

revoke execute on function public.import_contacts(jsonb) from public, anon;
grant execute on function public.import_contacts(jsonb) to authenticated;
