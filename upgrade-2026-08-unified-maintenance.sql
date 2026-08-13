-- Coconut Boats upgrade: unify vessel + engine maintenance into one table.
-- Run this in Supabase Dashboard > SQL Editor before deploying this project version.
-- Safe to run after upgrade-2026-08-engine-maintenance.sql.

begin;

-- Engine records need to be allowed to exist without pretending the engine itself
-- is the boat. Vessel records keep boat_id; engine records use engine_id and keep
-- boat_id_at_time as historical context.
alter table public.maintenance_records
  alter column boat_id drop not null;

alter table public.maintenance_records
  add column if not exists target_type text not null default 'boat',
  add column if not exists engine_id bigint references public.engines(id) on delete set null,
  add column if not exists boat_id_at_time bigint references public.boats(id) on delete set null,
  add column if not exists engine_pin_id bigint references public.engine_pins(id) on delete set null;

-- Existing maintenance records are vessel records.
update public.maintenance_records
set target_type = 'boat'
where target_type is null or target_type not in ('boat', 'engine');

alter table public.maintenance_records
  drop constraint if exists maintenance_records_target_type_check;
alter table public.maintenance_records
  add constraint maintenance_records_target_type_check
  check (target_type in ('boat', 'engine'));

-- Keep target relationships internally consistent.
alter table public.maintenance_records
  drop constraint if exists maintenance_records_target_relationship_check;
alter table public.maintenance_records
  add constraint maintenance_records_target_relationship_check
  check (
    (target_type = 'boat' and boat_id is not null and engine_id is null)
    or
    (target_type = 'engine' and engine_id is not null and boat_id is null)
  );

create index if not exists maintenance_records_engine_id_idx
  on public.maintenance_records(engine_id);
create index if not exists maintenance_records_target_type_idx
  on public.maintenance_records(target_type);
create index if not exists maintenance_records_engine_pin_id_idx
  on public.maintenance_records(engine_pin_id);

-- Migrate the temporary separate engine-maintenance table, if it exists.
-- Its pin_id pointed to engine_pins, so it becomes engine_pin_id here.
do $$
begin
  if to_regclass('public.engine_maintenance_records') is not null then
    insert into public.maintenance_records (
      target_type,
      boat_id,
      engine_id,
      boat_id_at_time,
      pin_id,
      engine_pin_id,
      title,
      item,
      description,
      system,
      category,
      status,
      date_created,
      due_date,
      completed_date,
      completed_by,
      work_order,
      notes,
      attachments,
      cost,
      created_at,
      updated_at
    )
    select
      'engine',
      null,
      engine_id,
      boat_id_at_time,
      null,
      pin_id,
      title,
      item,
      description,
      system,
      category,
      status,
      date_created,
      due_date,
      completed_date,
      completed_by,
      work_order,
      notes,
      attachments,
      cost,
      created_at,
      updated_at
    from public.engine_maintenance_records;

    drop table public.engine_maintenance_records;
  end if;
end $$;

commit;

-- Result:
-- maintenance_records.target_type = 'boat'   -> boat_id + pin_id
-- maintenance_records.target_type = 'engine' -> engine_id + engine_pin_id
-- engine records also retain boat_id_at_time so history still says where the engine was installed.
