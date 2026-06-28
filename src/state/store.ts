"use client";

import { create } from "zustand";
import {
  allSunk,
  canPlace,
  createBoard,
  fireAt,
  makePlacedShip,
  randomFleet,
} from "@/game/board";
import { FLEET } from "@/game/constants";
import {
  createAiState,
  chooseShot,
  registerResult,
  type AiState,
} from "@/game/ai";
import type {
  Board,
  Coord,
  Difficulty,
  Orientation,
  Phase,
  PlacedShip,
  Player,
  ShipId,
  ShotResult,
} from "@/game/types";

export interface LogEntry {
  id: number;
  side: Player;
  coord: Coord;
  outcome: ShotResult["outcome"];
  shipName?: string;
}

/** A transient event the FX / audio layer reacts to. `seq` makes each unique. */
export interface FxEvent {
  seq: number;
  side: Player;
  coord: Coord;
  outcome: ShotResult["outcome"];
  shipId?: ShipId;
  streak: number; // current consecutive-hit streak for the firing side
  finalBlow: boolean; // this shot ended the game
}

interface Stats {
  shots: number;
  hits: number;
}

export interface GameState {
  phase: Phase;
  difficulty: Difficulty;
  turn: Player;
  winner: Player | null;
  /** True during the cinematic beat between the killing blow and the result. */
  finishing: boolean;

  playerBoard: Board; // human fleet (visible to player)
  enemyBoard: Board; // AI fleet (hidden until sunk)
  aiState: AiState | null;

  log: LogEntry[];
  humanStats: Stats;
  aiStats: Stats;
  humanStreak: number;
  aiStreak: number;

  // ---- end-of-match trivia (aggregates that can't be derived from the
  // capped log) ----
  bestHitStreak: number; // longest run of consecutive human hits
  humanMissStreak: number; // current run of consecutive human misses
  humanLongestMiss: number; // longest such run
  aiMissStreak: number;
  aiLongestMiss: number;
  startedAt: number | null; // battle start timestamp (ms)
  endedAt: number | null; // killing-blow timestamp (ms)

  /** Placement-phase orientation toggle for the next ship drop. */
  placementOrientation: Orientation;
  /** True while the AI is "thinking" so the UI can lock input. */
  busy: boolean;

  fx: FxEvent | null;

  // ---- actions ----
  setDifficulty: (d: Difficulty) => void;
  startPlacement: () => void;
  setPlacementOrientation: (o: Orientation) => void;
  placePlayerShip: (id: ShipId, row: number, col: number, orientation: Orientation) => boolean;
  removePlayerShip: (id: ShipId) => void;
  randomizePlayer: () => void;
  clearPlayerBoard: () => void;
  readyUp: () => void;
  fireAtEnemy: (row: number, col: number) => void;
  runAiTurn: () => void;
  concludeToResult: () => void;
  rematch: () => void;
  backToMenu: () => void;
}

let SEQ = 0;
const nextSeq = () => ++SEQ;

function cloneBoard(b: Board): Board {
  return {
    size: b.size,
    ships: b.ships.map((s) => ({ ...s, cells: s.cells.map((c) => ({ ...c })) })),
    shots: new Set(b.shots),
  };
}

const shipName = (id?: ShipId) =>
  id ? FLEET.find((f) => f.id === id)?.name : undefined;

const freshState = () => ({
  turn: "human" as Player,
  winner: null,
  finishing: false,
  playerBoard: createBoard(),
  enemyBoard: createBoard(),
  aiState: null,
  log: [] as LogEntry[],
  humanStats: { shots: 0, hits: 0 },
  aiStats: { shots: 0, hits: 0 },
  humanStreak: 0,
  aiStreak: 0,
  bestHitStreak: 0,
  humanMissStreak: 0,
  humanLongestMiss: 0,
  aiMissStreak: 0,
  aiLongestMiss: 0,
  startedAt: null as number | null,
  endedAt: null as number | null,
  busy: false,
  fx: null as FxEvent | null,
});

export const useGame = create<GameState>((set, get) => ({
  phase: "menu",
  difficulty: "medium",
  placementOrientation: "horizontal",
  ...freshState(),

  setDifficulty: (d) => set({ difficulty: d }),

  startPlacement: () =>
    set({ phase: "placement", ...freshState() }),

  setPlacementOrientation: (o) => set({ placementOrientation: o }),

  placePlayerShip: (id, row, col, orientation) => {
    const def = FLEET.find((f) => f.id === id);
    if (!def) return false;
    const board = get().playerBoard;
    if (!canPlace(board.ships, row, col, def.size, orientation, id)) return false;
    const ships = board.ships.filter((s) => s.id !== id);
    ships.push(makePlacedShip(def, row, col, orientation));
    set({ playerBoard: { ...board, ships } });
    return true;
  },

  removePlayerShip: (id) => {
    const board = get().playerBoard;
    set({
      playerBoard: { ...board, ships: board.ships.filter((s) => s.id !== id) },
    });
  },

  randomizePlayer: () => {
    const board = get().playerBoard;
    set({ playerBoard: { ...board, ships: randomFleet() } });
  },

  clearPlayerBoard: () => {
    const board = get().playerBoard;
    set({ playerBoard: { ...board, ships: [] } });
  },

  readyUp: () => {
    const { playerBoard, difficulty } = get();
    if (playerBoard.ships.length !== FLEET.length) return;
    const enemyBoard = createBoard();
    enemyBoard.ships = randomFleet();
    set({
      phase: "battle",
      enemyBoard,
      aiState: createAiState(difficulty),
      turn: "human",
      startedAt: Date.now(),
      endedAt: null,
    });
  },

  fireAtEnemy: (row, col) => {
    const state = get();
    if (state.phase !== "battle" || state.turn !== "human" || state.busy) return;
    if (state.enemyBoard.shots.has(`${row},${col}`)) return;

    const enemyBoard = cloneBoard(state.enemyBoard);
    const result = fireAt(enemyBoard, row, col);
    if (result.outcome === "repeat") return;

    const hit = result.outcome === "hit" || result.outcome === "sunk";
    const streak = hit ? state.humanStreak + 1 : 0;
    const bestHitStreak = Math.max(state.bestHitStreak, streak);
    const humanMissStreak = hit ? 0 : state.humanMissStreak + 1;
    const humanLongestMiss = Math.max(state.humanLongestMiss, humanMissStreak);
    const won = allSunk(enemyBoard);

    set({
      enemyBoard,
      humanStats: {
        shots: state.humanStats.shots + 1,
        hits: state.humanStats.hits + (hit ? 1 : 0),
      },
      humanStreak: streak,
      bestHitStreak,
      humanMissStreak,
      humanLongestMiss,
      endedAt: won ? Date.now() : state.endedAt,
      log: [
        {
          id: nextSeq(),
          side: "human" as Player,
          coord: result.coord,
          outcome: result.outcome,
          shipName: shipName(result.shipId),
        },
        ...state.log,
      ].slice(0, 200),
      fx: {
        seq: nextSeq(),
        side: "human",
        coord: result.coord,
        outcome: result.outcome,
        shipId: result.shipId,
        streak,
        finalBlow: won,
      },
      winner: won ? "human" : null,
      finishing: won,
      phase: "battle", // stay in battle for the cinematic; Game flips to result
      turn: won ? "human" : hit ? "human" : "ai",
      busy: won ? true : !hit, // lock input during finish or while AI takes over
    });
    // On a miss, hand the turn to the AI (the UI schedules runAiTurn with delay).
  },

  runAiTurn: () => {
    const state = get();
    if (state.phase !== "battle" || state.turn !== "ai" || !state.aiState) return;

    const aiState = state.aiState;
    const remainingSizes = state.playerBoard.ships
      .filter((s) => !s.sunk)
      .map((s) => s.size);

    const shot = chooseShot(aiState, remainingSizes);
    const playerBoard = cloneBoard(state.playerBoard);
    const result = fireAt(playerBoard, shot.row, shot.col);
    registerResult(aiState, result);

    const hit = result.outcome === "hit" || result.outcome === "sunk";
    const streak = hit ? state.aiStreak + 1 : 0;
    const aiMissStreak = hit ? 0 : state.aiMissStreak + 1;
    const aiLongestMiss = Math.max(state.aiLongestMiss, aiMissStreak);
    const lost = allSunk(playerBoard);

    set({
      playerBoard,
      aiState,
      aiStats: {
        shots: state.aiStats.shots + 1,
        hits: state.aiStats.hits + (hit ? 1 : 0),
      },
      aiStreak: streak,
      aiMissStreak,
      aiLongestMiss,
      endedAt: lost ? Date.now() : state.endedAt,
      log: [
        {
          id: nextSeq(),
          side: "ai" as Player,
          coord: result.coord,
          outcome: result.outcome,
          shipName: shipName(result.shipId),
        },
        ...state.log,
      ].slice(0, 200),
      fx: {
        seq: nextSeq(),
        side: "ai",
        coord: result.coord,
        outcome: result.outcome,
        shipId: result.shipId,
        streak,
        finalBlow: lost,
      },
      winner: lost ? "ai" : null,
      finishing: lost,
      phase: "battle", // stay in battle for the cinematic; Game flips to result
      // AI keeps firing while it scores hits; otherwise back to the human.
      turn: lost ? "ai" : hit ? "ai" : "human",
      busy: lost ? true : hit, // stay busy if AI gets another shot or finishing
    });
  },

  concludeToResult: () => set({ phase: "result", finishing: false }),

  rematch: () => set({ phase: "placement", ...freshState() }),

  backToMenu: () => set({ phase: "menu", ...freshState() }),
}));
