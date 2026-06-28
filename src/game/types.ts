// Pure, framework-agnostic domain types for ARMADA.
// Nothing in this folder may import React, Pixi, or any browser API.

export type ShipId = "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";

export type Orientation = "horizontal" | "vertical";

export interface ShipDef {
  id: ShipId;
  name: string;
  size: number;
}

/** A ship placed on a board. `cells` is derived but cached for fast lookups. */
export interface PlacedShip {
  id: ShipId;
  size: number;
  row: number; // anchor (top-most / left-most) cell
  col: number;
  orientation: Orientation;
  cells: Coord[];
  hits: number; // number of cells hit
  sunk: boolean;
}

export interface Coord {
  row: number;
  col: number;
}

export type CellState = "empty" | "ship" | "hit" | "miss" | "sunk";

export type Player = "human" | "ai";

export type Difficulty = "easy" | "medium" | "hard";

export type Phase = "menu" | "placement" | "battle" | "result";

/** Result of resolving a single shot. */
export interface ShotResult {
  coord: Coord;
  outcome: "hit" | "miss" | "sunk" | "repeat";
  shipId?: ShipId; // present on hit/sunk
}

/** A 10x10 board. Ships only exist for the side that owns them. */
export interface Board {
  size: number;
  ships: PlacedShip[];
  /** Coordinates that have been fired upon by the opponent. */
  shots: Set<string>; // "r,c"
}
