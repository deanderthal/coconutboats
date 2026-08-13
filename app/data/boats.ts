import type { SupabaseClient } from "@supabase/supabase-js";

export type Boat = {
  id: number;
  boat_code: string;
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
  fuel_capacity: string | null;
  battery_type: string | null;
  photo: string | null;
  schematic: string | null;
  notes: string | null;
};

export async function fetchBoats(client: SupabaseClient): Promise<Boat[]> {
  const { data, error } = await client
    .from("boats")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Boat[];
}

export async function fetchBoat(client: SupabaseClient, id: number): Promise<Boat | null> {
  const { data, error } = await client
    .from("boats")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as Boat | null;
}
