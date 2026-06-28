import { describe, it, expect } from "vitest";
import {
  createBoard,
  makePlacedShip,
  canPlace,
  fireAt,
  allSunk,
  randomFleet,
  shipCells,
  cellStateForTargeting,
} from "./board";
import { TOTAL_SHIP_CELLS, FLEET } from "./constants";
import { mulberry32 } from "./rng";

describe("shipCells", () => {
  it("lays cells horizontally from the anchor", () => {
    expect(shipCells(2, 3, 3, "horizontal")).toEqual([
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 2, col: 5 },
    ]);
  });
  it("lays cells vertically from the anchor", () => {
    expect(shipCells(2, 3, 2, "vertical")).toEqual([
      { row: 2, col: 3 },
      { row: 3, col: 3 },
    ]);
  });
});

describe("canPlace", () => {
  it("rejects out-of-bounds placement", () => {
    expect(canPlace([], 0, 8, 5, "horizontal")).toBe(false); // 8,9,10,11,12
    expect(canPlace([], 8, 0, 5, "vertical")).toBe(false);
  });
  it("accepts in-bounds placement on an empty board", () => {
    expect(canPlace([], 0, 0, 5, "horizontal")).toBe(true);
  });
  it("rejects overlap with an existing ship", () => {
    const ships = [makePlacedShip({ id: "carrier", size: 5 }, 0, 0, "horizontal")];
    expect(canPlace(ships, 0, 2, 3, "vertical")).toBe(false); // overlaps at (0,2)
  });
  it("allows a ship to ignore its own footprint when re-placing", () => {
    const ships = [makePlacedShip({ id: "carrier", size: 5 }, 0, 0, "horizontal")];
    // Re-placing onto its own current footprint is allowed when ignoring self...
    expect(canPlace(ships, 0, 0, 5, "horizontal", "carrier")).toBe(true);
    // ...but a second ship may NOT use those cells.
    expect(canPlace(ships, 0, 0, 5, "horizontal", "battleship")).toBe(false);
    // ...and bounds are still enforced even when ignoring self.
    expect(canPlace(ships, 0, 6, 5, "horizontal", "carrier")).toBe(false); // cols 6..10
  });
});

describe("fireAt — hit detection", () => {
  it("returns miss on empty water and records the shot", () => {
    const board = createBoard();
    board.ships = [makePlacedShip({ id: "destroyer", size: 2 }, 0, 0, "horizontal")];
    const r = fireAt(board, 5, 5);
    expect(r.outcome).toBe("miss");
    expect(board.shots.has("5,5")).toBe(true);
  });

  it("returns hit when a ship cell is struck", () => {
    const board = createBoard();
    board.ships = [makePlacedShip({ id: "destroyer", size: 2 }, 0, 0, "horizontal")];
    const r = fireAt(board, 0, 0);
    expect(r.outcome).toBe("hit");
    expect(r.shipId).toBe("destroyer");
  });

  it("returns sunk when the final ship cell is struck", () => {
    const board = createBoard();
    board.ships = [makePlacedShip({ id: "destroyer", size: 2 }, 0, 0, "horizontal")];
    expect(fireAt(board, 0, 0).outcome).toBe("hit");
    const r = fireAt(board, 0, 1);
    expect(r.outcome).toBe("sunk");
    expect(board.ships[0].sunk).toBe(true);
  });

  it("returns repeat for a previously fired cell", () => {
    const board = createBoard();
    board.ships = [makePlacedShip({ id: "destroyer", size: 2 }, 0, 0, "horizontal")];
    fireAt(board, 3, 3);
    expect(fireAt(board, 3, 3).outcome).toBe("repeat");
  });
});

describe("cellStateForTargeting", () => {
  it("reflects empty, miss, hit and sunk", () => {
    const board = createBoard();
    board.ships = [makePlacedShip({ id: "destroyer", size: 2 }, 0, 0, "horizontal")];
    expect(cellStateForTargeting(board, 0, 0)).toBe("empty");
    fireAt(board, 9, 9);
    expect(cellStateForTargeting(board, 9, 9)).toBe("miss");
    fireAt(board, 0, 0);
    expect(cellStateForTargeting(board, 0, 0)).toBe("hit");
    fireAt(board, 0, 1);
    expect(cellStateForTargeting(board, 0, 0)).toBe("sunk");
  });
});

describe("allSunk — win condition", () => {
  it("is false until every ship is destroyed, then true", () => {
    const board = createBoard();
    board.ships = randomFleet(mulberry32(42));
    expect(board.ships.length).toBe(FLEET.length);
    expect(allSunk(board)).toBe(false);

    // Fire at every ship cell.
    for (const ship of board.ships) {
      for (const cell of ship.cells) fireAt(board, cell.row, cell.col);
    }
    expect(allSunk(board)).toBe(true);
  });

  it("is false for an empty board", () => {
    expect(allSunk(createBoard())).toBe(false);
  });
});

describe("randomFleet", () => {
  it("places the full fleet with no overlaps and all in bounds", () => {
    const ships = randomFleet(mulberry32(7));
    expect(ships.map((s) => s.id).sort()).toEqual(
      FLEET.map((s) => s.id).sort(),
    );
    const occupied = new Set<string>();
    let total = 0;
    for (const ship of ships) {
      for (const c of ship.cells) {
        expect(c.row).toBeGreaterThanOrEqual(0);
        expect(c.row).toBeLessThan(10);
        expect(c.col).toBeGreaterThanOrEqual(0);
        expect(c.col).toBeLessThan(10);
        const k = `${c.row},${c.col}`;
        expect(occupied.has(k)).toBe(false); // no overlap
        occupied.add(k);
        total++;
      }
    }
    expect(total).toBe(TOTAL_SHIP_CELLS);
  });

  it("is deterministic for a given seed", () => {
    const a = randomFleet(mulberry32(123));
    const b = randomFleet(mulberry32(123));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
