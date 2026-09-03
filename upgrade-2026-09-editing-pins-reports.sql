-- Run once in Supabase Dashboard > SQL Editor before deploying this version.
begin;

alter table public.maintenance_records
  add column if not exists completed_at timestamptz;

update public.maintenance_records
set completed_at = completed_date::timestamp at time zone 'Pacific/Honolulu'
where status = 'Done' and completed_date is not null and completed_at is null;

create index if not exists maintenance_records_completed_at_idx
  on public.maintenance_records(completed_at);

create or replace function public.delete_orphaned_maintenance_pin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.pin_id is not null and not exists (
    select 1 from public.maintenance_records where pin_id = old.pin_id
  ) then
    delete from public.maintenance_pins where id = old.pin_id;
  end if;
  if old.engine_pin_id is not null and not exists (
    select 1 from public.maintenance_records where engine_pin_id = old.engine_pin_id
  ) then
    delete from public.engine_pins where id = old.engine_pin_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists maintenance_records_delete_orphaned_pin on public.maintenance_records;
create trigger maintenance_records_delete_orphaned_pin
after delete or update of pin_id, engine_pin_id on public.maintenance_records
for each row execute function public.delete_orphaned_maintenance_pin();

commit;
