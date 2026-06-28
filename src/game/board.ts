import { BOARD_SIZE, FLEET } from "./constants";
import type {
  Board,
  Coord,
  Orientation,
  PlacedShip,
  ShipDef,
  ShipId,
  ShotResult,
} from "./types";

export const keyOf = (row: number, col: number): string => `${row},${col}`;
export const coordKey = (c: Coord): string => keyOf(c.row, c.col);

export const inBounds = (row: number, col: number, size = BOARD_SIZE): boolean =>
  row >= 0 && col >= 0 && row < size && col < size;

/** Compute the cells a ship would occupy from its anchor + orientation. */
export function shipCells(
  row: number,
  col: number,
  size: number,
  orientation: Orientation,
): Coord[] {
  const cells: Coord[] = [];
  for (let i = 0; i < size; i++) {
    cells.push(
      orientation === "horizontal"
        ? { row, col: col + i }
        : { row: row + i, col },
    );
  }
  return cells;
}

export function createBoard(): Board {
  return { size: BOARD_SIZE, ships: [], shots: new Set<string>() };
}

/** Build a PlacedShip object, computing & caching its cells. */
export function makePlacedShip(
  def: Pick<ShipDef, "id" | "size">,
  row: number,
  col: number,
  orientation: Orientation,
): PlacedShip {
  return {
    id: def.id,
    size: def.size,
    row,
    col,
    orientation,
    cells: shipCells(row, col, def.size, orientation),
    hits: 0,
    sunk: false,
  };
}

/**
 * Can a ship of `size` be placed at (row,col) with `orientation` without going
 * out of bounds or overlapping any existing ship in `ships`? `ignoreId` lets a
 * ship be "moved" past its own current footprint during drag.
 */
export function canPlace(
  ships: PlacedShip[],
  row: number,
  col: number,
  size: number,
  orientation: Orientation,
  ignoreId?: ShipId,
): boolean {
  const cells = shipCells(row, col, size, orientation);
  for (const c of cells) {
    if (!inBounds(c.row, c.col)) return false;
  }
  const occupied = new Set<string>();
  for (const s of ships) {
    if (s.id === ignoreId) continue;
    for (const c of s.cells) occupied.add(coordKey(c));
  }
  return cells.every((c) => !occupied.has(coordKey(c)));
}

/** Place or replace a ship on the board (immutably returns a new ship list). */
export function placeShip(
  ships: PlacedShip[],
  ship: PlacedShip,
): PlacedShip[] {
  const next = ships.filter((s) => s.id !== ship.id);
  next.push(ship);
  return next;
}

/**
 * Deterministically-seedable random fleet placement. Pass a `rng` (0..1) for
 * reproducible tests; defaults to Math.random.
 */
export function randomFleet(rng: () => number = Math.random): PlacedShip[] {
  const ships: PlacedShip[] = [];
  for (const def of FLEET) {
    let placed = false;
    let guard = 0;
    while (!placed && guard++ < 1000) {
      const orientation: Orientation = rng() < 0.5 ? "horizontal" : "vertical";
      const row = Math.floor(rng() * BOARD_SIZE);
      const col = Math.floor(rng() * BOARD_SIZE);
      if (canPlace(ships, row, col, def.size, orientation)) {
        ships.push(makePlacedShip(def, row, col, orientation));
        placed = true;
      }
    }
  }
  return ships;
}

/** Resolve a shot at (row,col) against a board. Mutates board (shots + ship hits). */
export function fireAt(board: Board, row: number, col: number): ShotResult {
  const k = keyOf(row, col);
  const coord: Coord = { row, col };
  if (board.shots.has(k)) {
    return { coord, outcome: "repeat" };
  }
  board.shots.add(k);

  const ship = board.ships.find((s) =>
    s.cells.some((c) => c.row === row && c.col === col),
  );
  if (!ship) {
    return { coord, outcome: "miss" };
  }
  ship.hits += 1;
  if (ship.hits >= ship.size) {
    ship.sunk = true;
    return { coord, outcome: "sunk", shipId: ship.id };
  }
  return { coord, outcome: "hit", shipId: ship.id };
}

/** Has every ship on the board been sunk? */
export function allSunk(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every((s) => s.sunk);
}

/** Cell-level state for rendering an opponent-visible (targeting) view. */
export function cellStateForTargeting(board: Board, row: number, col: number) {
  const k = keyOf(row, col);
  if (!board.shots.has(k)) return "empty" as const;
  const ship = board.ships.find((s) =>
    s.cells.some((c) => c.row === row && c.col === col),
  );
  if (!ship) return "miss" as const;
  return ship.sunk ? ("sunk" as const) : ("hit" as const);
}
