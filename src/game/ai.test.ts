import { describe, it, expect } from "vitest";
import {
  createAiState,
  chooseShot,
  registerResult,
} from "./ai";
import { createBoard, fireAt, makePlacedShip, allSunk, randomFleet } from "./board";
import { FLEET } from "./constants";
import { mulberry32 } from "./rng";
import type { Coord, ShotResult } from "./types";

const remaining = FLEET.map((s) => s.size);

describe("AI — never repeats a shot", () => {
  it("easy/medium/hard all avoid firing the same cell twice", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const state = createAiState(difficulty, mulberry32(99));
      const board = createBoard();
      board.ships = randomFleet(mulberry32(1));
      const seen = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const shot = chooseShot(state, remaining);
        const k = `${shot.row},${shot.col}`;
        expect(seen.has(k)).toBe(false);
        seen.add(k);
        const res = fireAt(board, shot.row, shot.col);
        registerResult(state, res);
      }
      expect(seen.size).toBe(100); // entire 10x10 board, no repeats
    }
  });
});

describe("AI medium — targets adjacent cells after a hit", () => {
  it("queues orthogonal neighbours of a hit", () => {
    const state = createAiState("medium", mulberry32(5));
    const hit: ShotResult = { coord: { row: 5, col: 5 }, outcome: "hit", shipId: "cruiser" };
    registerResult(state, hit);
    const next = chooseShot(state, remaining);
    const neighbours: Coord[] = [
      { row: 4, col: 5 },
      { row: 6, col: 5 },
      { row: 5, col: 4 },
      { row: 5, col: 6 },
    ];
    expect(neighbours.some((n) => n.row === next.row && n.col === next.col)).toBe(true);
  });

  it("extends along a line once two colinear hits are found", () => {
    const state = createAiState("medium", mulberry32(5));
    registerResult(state, { coord: { row: 5, col: 5 }, outcome: "hit", shipId: "cruiser" });
    registerResult(state, { coord: { row: 5, col: 6 }, outcome: "hit", shipId: "cruiser" });
    // Queue should now only contain the two ends: (5,4) and (5,7).
    const candidates: Coord[] = [];
    for (let i = 0; i < 2; i++) {
      const shot = chooseShot(state, remaining);
      candidates.push(shot);
      registerResult(state, { coord: shot, outcome: "miss" });
    }
    const isEnd = (c: Coord) =>
      (c.row === 5 && c.col === 4) || (c.row === 5 && c.col === 7);
    expect(candidates.every(isEnd)).toBe(true);
  });

  it("clears its hunt after a ship is sunk", () => {
    const state = createAiState("medium", mulberry32(5));
    registerResult(state, { coord: { row: 5, col: 5 }, outcome: "hit", shipId: "destroyer" });
    registerResult(state, { coord: { row: 5, col: 6 }, outcome: "sunk", shipId: "destroyer" });
    expect(state.queue.length).toBe(0);
    expect(state.activeHits.length).toBe(0);
  });
});

describe("AI hard — probability hunting actually wins", () => {
  it("sinks an entire fleet within the board's cell budget", () => {
    const state = createAiState("hard", mulberry32(2024));
    const board = createBoard();
    board.ships = randomFleet(mulberry32(2024));

    let shots = 0;
    while (!allSunk(board) && shots < 100) {
      const remainingSizes = board.ships.filter((s) => !s.sunk).map((s) => s.size);
      const shot = chooseShot(state, remainingSizes);
      const res = fireAt(board, shot.row, shot.col);
      registerResult(state, res);
      shots++;
    }
    expect(allSunk(board)).toBe(true);
    // Hard AI should be meaningfully better than firing all 100 cells.
    expect(shots).toBeLessThan(100);
  });

  it("hard AI on average beats a fixed shot budget across seeds", () => {
    let totalShots = 0;
    const trials = 20;
    for (let t = 0; t < trials; t++) {
      const state = createAiState("hard", mulberry32(t * 7 + 1));
      const board = createBoard();
      board.ships = randomFleet(mulberry32(t * 13 + 3));
      let shots = 0;
      while (!allSunk(board) && shots < 100) {
        const remainingSizes = board.ships.filter((s) => !s.sunk).map((s) => s.size);
        const shot = chooseShot(state, remainingSizes);
        registerResult(state, fireAt(board, shot.row, shot.col));
        shots++;
      }
      totalShots += shots;
    }
    const avg = totalShots / trials;
    // Probability/parity hunting should comfortably average under ~70 shots.
    expect(avg).toBeLessThan(75);
  });
});

describe("AI single-cell makePlacedShip sanity", () => {
  it("finds and sinks a lone destroyer", () => {
    const state = createAiState("hard", mulberry32(11));
    const board = createBoard();
    board.ships = [makePlacedShip({ id: "destroyer", size: 2 }, 4, 4, "horizontal")];
    let shots = 0;
    while (!allSunk(board) && shots < 100) {
      const shot = chooseShot(state, [2]);
      registerResult(state, fireAt(board, shot.row, shot.col));
      shots++;
    }
    expect(allSunk(board)).toBe(true);
  });
});
