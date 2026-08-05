export type Boat = {
  id: number;
  name: string;
  type: string;
  location: string;
  status: "Active" | "Inactive";

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

export const boats: Boat[] = [
 {
  id: 1,
  name: "MD1",
  type: "Marine Debris Vessel",
  make: "Zodiac",
  model: "FC570",
  year: "2022",
  length: "TBD",
  hullNumber: "TBD",
  registration: "TBD",
  engines: "40hp Tohatsu",
  engineUrl: "https://marine.honda.com/outboards/mid-range/bf150",
  fuelCapacity: "TBD",
  batteryType: "TBD",
  location: "PMDP Baseyard",
  status: "Active",
  photo: "/boats/md1.jpg",
  schematic: "/schematics/zodiac_schematic.png",
  notes: "Honey Girl, Pineapple Express, Etc."
},
  {
    id: 2,
    name: "MD2",
    type: "Marine Debris Vessel",
    location: "PMDP Baseyard",
    status: "Active",
    schematic: "/schematics/md-series.png",
  },
  {
    id: 3,
    name: "MD3",
    type: "Marine Debris Vessel",
    location: "PMDP Baseyard",
    status: "Active",
    schematic: "/schematics/md-series.png",
  },
  {
    id: 4,
    name: "MD4",
    type: "Marine Debris Vessel",
    location: "PMDP Baseyard",
    status: "Active",
    schematic: "/schematics/md-series.png",
  },
  {
    id: 5,
    name: "MD5",
    type: "Marine Debris Vessel",
    location: "PMDP Baseyard",
    status: "Active",
    schematic: "/schematics/md-series.png",
  },
  {
    id: 6,
    name: "Extracto",
    type: "Debris Recovery Vessel",
    location: "PMDP Baseyard",
    status: "Active",
    schematic: "/schematics/extracto.png",
  },
];