import { BOARD_SIZE } from "./constants";
import { keyOf, inBounds } from "./board";
import type { Board, Coord, Difficulty, ShotResult } from "./types";

/**
 * The AI never sees ship positions — it only knows which of ITS shots landed.
 * State is kept in `AiState` so the controller can persist it between turns.
 */
export interface AiState {
  difficulty: Difficulty;
  /** Cells already fired upon by the AI. */
  fired: Set<string>;
  /** Hunt queue of promising adjacent targets (medium/hard target mode). */
  queue: Coord[];
  /** Open hits belonging to a ship currently being hunted (not yet sunk). */
  activeHits: Coord[];
  rng: () => number;
}

export function createAiState(
  difficulty: Difficulty,
  rng: () => number = Math.random,
): AiState {
  return { difficulty, fired: new Set<string>(), queue: [], activeHits: [], rng };
}

const ORTHO: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function unfiredCells(state: AiState): Coord[] {
  const out: Coord[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!state.fired.has(keyOf(r, c))) out.push({ row: r, col: c });
    }
  }
  return out;
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ---------- EASY: pure random ----------
function chooseEasy(state: AiState): Coord {
  return pick(unfiredCells(state), state.rng);
}

// ---------- MEDIUM: hunt / target ----------
// Random hunting; on a hit, enqueue orthogonal neighbours and drain that queue.
function chooseMedium(state: AiState): Coord {
  while (state.queue.length > 0) {
    const next = state.queue.shift()!;
    if (!state.fired.has(keyOf(next.row, next.col))) return next;
  }
  return chooseEasy(state);
}

// ---------- HARD: probability density + parity ----------
// Build a heat map of how many ways each remaining ship could fit over each
// unfired cell. While hunting a damaged ship, weight cells in line with hits.
function chooseHard(state: AiState, remainingShipSizes: number[]): Coord {
  // If we have open hits, prefer cells colinear with them (target mode).
  if (state.activeHits.length > 0) {
    const targeted = chooseMedium(state);
    return targeted;
  }

  const size = BOARD_SIZE;
  const heat: number[][] = Array.from({ length: size }, () =>
    new Array(size).fill(0),
  );

  const canFit = (cells: Coord[]): boolean =>
    cells.every(
      (c) => inBounds(c.row, c.col) && !state.fired.has(keyOf(c.row, c.col)),
    );

  for (const shipSize of remainingShipSizes) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // horizontal
        const h: Coord[] = [];
        for (let i = 0; i < shipSize; i++) h.push({ row: r, col: c + i });
        if (canFit(h)) for (const cell of h) heat[cell.row][cell.col]++;
        // vertical
        const v: Coord[] = [];
        for (let i = 0; i < shipSize; i++) v.push({ row: r + i, col: c });
        if (canFit(v)) for (const cell of v) heat[cell.row][cell.col]++;
      }
    }
  }

  // Parity: smallest remaining ship is 2, so only cells where (r+c) is even can
  // host an as-yet-untouched ship of length >= 2 are worth hunting. Bias heat.
  const minSize = Math.min(...remainingShipSizes, 2);
  let best: Coord | null = null;
  let bestScore = -1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (state.fired.has(keyOf(r, c))) continue;
      let score = heat[r][c];
      if (minSize >= 2 && (r + c) % 2 !== 0) score *= 0.5; // parity de-emphasis
      // tiny deterministic-ish jitter to break ties without thrashing
      score += state.rng() * 0.01;
      if (score > bestScore) {
        bestScore = score;
        best = { row: r, col: c };
      }
    }
  }
  return best ?? chooseEasy(state);
}

/** Choose the AI's next shot coordinate. */
export function chooseShot(
  state: AiState,
  remainingShipSizes: number[],
): Coord {
  switch (state.difficulty) {
    case "easy":
      return chooseEasy(state);
    case "medium":
      return chooseMedium(state);
    case "hard":
      return chooseHard(state, remainingShipSizes);
  }
}

/**
 * Feed the result of the AI's shot back into its state so hunt/target logic and
 * the heat map stay accurate. Call this for medium & hard.
 */
export function registerResult(state: AiState, result: ShotResult): void {
  state.fired.add(keyOf(result.coord.row, result.coord.col));
  if (state.difficulty === "easy") return;

  if (result.outcome === "hit") {
    state.activeHits.push(result.coord);
    enqueueTargets(state);
  } else if (result.outcome === "sunk") {
    // Ship destroyed: clear the hunt and discard now-useless queued probes.
    state.activeHits = [];
    state.queue = [];
  }
}

/**
 * Recompute the probe queue from current open hits. With 2+ colinear hits we
 * only probe along that line; with a single hit we probe all 4 neighbours.
 */
function enqueueTargets(state: AiState): void {
  const hits = state.activeHits;
  state.queue = [];
  if (hits.length === 0) return;

  if (hits.length === 1) {
    const { row, col } = hits[0];
    for (const [dr, dc] of ORTHO) {
      const cell = { row: row + dr, col: col + dc };
      if (inBounds(cell.row, cell.col) && !state.fired.has(keyOf(cell.row, cell.col))) {
        state.queue.push(cell);
      }
    }
    return;
  }

  // Determine line orientation from the first two hits.
  const sameRow = hits.every((h) => h.row === hits[0].row);
  const sameCol = hits.every((h) => h.col === hits[0].col);

  if (sameRow) {
    const row = hits[0].row;
    const cols = hits.map((h) => h.col).sort((a, b) => a - b);
    const ends = [
      { row, col: cols[0] - 1 },
      { row, col: cols[cols.length - 1] + 1 },
    ];
    for (const e of ends) {
      if (inBounds(e.row, e.col) && !state.fired.has(keyOf(e.row, e.col))) {
        state.queue.push(e);
      }
    }
  } else if (sameCol) {
    const col = hits[0].col;
    const rows = hits.map((h) => h.row).sort((a, b) => a - b);
    const ends = [
      { row: rows[0] - 1, col },
      { row: rows[rows.length - 1] + 1, col },
    ];
    for (const e of ends) {
      if (inBounds(e.row, e.col) && !state.fired.has(keyOf(e.row, e.col))) {
        state.queue.push(e);
      }
    }
  } else {
    // Hits not colinear (adjacent ships) — fall back to neighbour probing.
    for (const h of hits) {
      for (const [dr, dc] of ORTHO) {
        const cell = { row: h.row + dr, col: h.col + dc };
        if (inBounds(cell.row, cell.col) && !state.fired.has(keyOf(cell.row, cell.col))) {
          state.queue.push(cell);
        }
      }
    }
  }
}
