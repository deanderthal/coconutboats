# Coconut Boats – Engine / Maintenance Upgrade

## Install order

1. **Back up Supabase first.** Export the current `boats`, `maintenance_records`, `maintenance_pins`, and `todos` tables as CSV if you want a belt-and-suspenders copy.
2. In Supabase **SQL Editor**, run `upgrade-2026-08-engine-maintenance.sql` once.
3. Keep your existing `.env.local`. It is intentionally not included in the replacement download.
4. Replace the app source with this folder (or copy the changed files into your existing repo).
5. Run `npm install` if needed, then `npm run dev` locally. This project intentionally uses Webpack for development because Turbopack was crashing on the dynamic boat route.
6. In Supabase, edit `boats.boat_code` values (`KNK`, `FB1`, etc.).
7. Add each physical outboard once in the new `engines` table. Give it a permanent `engine_code` such as `E01`, its schematic path/URL, lifetime hours, and service hours.
8. To move a motor between boats, edit only `engines.boat_id` and `engines.position` (`Single`, `Port`, `Starboard`, `Other`). Its hours, engine pins, and engine maintenance history follow it.
9. Commit and push normally: `git add .`, `git commit -m "Add swappable engine maintenance"`, `git push`.

## What changed

- Boats and engines are separate assets.
- Each assigned engine can have its own schematic, pins, maintenance records, lifetime hours, and since-service hours.
- Engine service warning appears at the engine's `service_interval_hours` (default 90 hours).
- The Maintenance System dropdown is above the schematic and filters **both records and pins**.
- Maintenance records have **Edit** and **Delete**.
- Cost is editable and exported.
- Maintenance status is now: `Open Issue`, `Scheduled`, `Done`.
- Category is now: `Repair`, `Routine Maintenance`, `Observation`, `Admin`.
- The To-Do tab is no longer a separate data source. It shows `Open Issue` records and `Scheduled` records that are overdue or within 10 days.
- Existing `todos` are migrated into `maintenance_records`, then the old `todos` table is removed.
- CSV export is available from the Maintenance tab and includes `boat_code`, record type, engine code/position, cost, dates, and notes.
- TypeScript now uses the same `snake_case` field names as Supabase. `mapBoat` and camelCase database mappings are gone.

## Existing pins

Old boat pins did not have a System stored on them. The migration marks them `Unassigned`. New pins save the currently selected System, which is what allows the schematic pin filtering to work. Recreate or reassign old pins as needed.

## Old engine columns on boats

The old `boats.engines` and `boats.engine_url` columns are intentionally left in Supabase for now so the migration does not destroy data. The new app ignores them. Once the new `engines` table is populated and verified, you can delete those obsolete columns later.

## Unified vessel + engine maintenance upgrade

For the Vessel Maintenance / Engine Maintenance split, run:

`upgrade-2026-08-unified-maintenance.sql`

This moves any rows from the temporary `engine_maintenance_records` table into `maintenance_records`, then removes the separate table. Vessel and engine repairs now use one form and one maintenance table. Engine records use `engine_id`; vessel records use `boat_id`.

## September 2026 overview, pin, time, and reporting upgrade

Before deploying this version, run this once in Supabase SQL Editor:

`upgrade-2026-09-editing-pins-reports.sql`

It adds the exact `completed_at` timestamp used by completed-work reports, backfills existing completed records, and automatically removes a schematic pin when its final maintenance record is deleted. The app now uses the Hawaiʻi calendar date when creating or completing records, allows vessel details to be edited from Overview, and exports completed-work CSV reports for the last 7, 30, or 365 days or all time.
