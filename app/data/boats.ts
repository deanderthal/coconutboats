import type { SupabaseClient } from "@supabase/supabase-js";

export type Boat = {
  id: number;
  name: string;
  nickname?: string;
  type: string;
  location: string;
  status: "Active" | "Inactive";
  sortOrder: number;

  make?: string;
  model?: string;
  year?: string;
  length?: string;
  hullNumber?: string;
  registration?: string;

  engines?: string;
  engineUrl?: string;
  fuelCapacity?: string;
  batteryType?: string;

  photo?: string;
  schematic?: string;
  notes?: string;
};

type BoatRow = {
  id: number;
  name: string;
  nickname: string | null;
  type: string;
  location: string;
  status: "Active" | "Inactive";
  sort_order: number;
  make: string | null;
  model: string | null;
  year: string | null;
  length: string | null;
  hull_number: string | null;
  registration: string | null;
  engines: string | null;
  engine_url: string | null;
  fuel_capacity: string | null;
  battery_type: string | null;
  photo: string | null;
  schematic: string | null;
  notes: string | null;
};

function optional(value: string | null): string | undefined {
  return value ?? undefined;
}

export function mapBoat(row: BoatRow): Boat {
  return {
    id: row.id,
    name: row.name,
    nickname: optional(row.nickname),
    type: row.type,
    location: row.location,
    status: row.status,
    sortOrder: row.sort_order,
    make: optional(row.make),
    model: optional(row.model),
    year: optional(row.year),
    length: optional(row.length),
    hullNumber: optional(row.hull_number),
    registration: optional(row.registration),
    engines: optional(row.engines),
    engineUrl: optional(row.engine_url),
    fuelCapacity: optional(row.fuel_capacity),
    batteryType: optional(row.battery_type),
    photo: optional(row.photo),
    schematic: optional(row.schematic),
    notes: optional(row.notes),
  };
}

export async function fetchBoats(client: SupabaseClient): Promise<Boat[]> {
  const { data, error } = await client
    .from("boats")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapBoat(row as BoatRow));
}

export async function fetchBoat(
  client: SupabaseClient,
  id: number
): Promise<Boat | null> {
  const { data, error } = await client
    .from("boats")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapBoat(data as BoatRow) : null;
}
