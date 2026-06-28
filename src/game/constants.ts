import type { ShipDef } from "./types";

export const BOARD_SIZE = 10;

/** Standard classic Battleship fleet. Order = placement order in the UI. */
export const FLEET: ShipDef[] = [
  { id: "carrier", name: "Carrier", size: 5 },
  { id: "battleship", name: "Battleship", size: 4 },
  { id: "cruiser", name: "Cruiser", size: 3 },
  { id: "submarine", name: "Submarine", size: 3 },
  { id: "destroyer", name: "Destroyer", size: 2 },
];

export const TOTAL_SHIP_CELLS = FLEET.reduce((sum, s) => sum + s.size, 0); // 17
