"use client";

import { useCallback, useRef, useState } from "react";
import { BOARD_SIZE } from "@/game/constants";
import { keyOf } from "@/game/board";
import type { Board, Coord, ShipId } from "@/game/types";

export type GridVariant = "player" | "target";

export interface PreviewState {
  cells: Coord[];
  valid: boolean;
}

interface GridProps {
  variant: GridVariant;
  board: Board;
  interactive?: boolean;
  disabled?: boolean;
  preview?: PreviewState | null;
  /** Highlight the cells of this ship (placement selection). */
  selectedId?: ShipId | null;
  /** Target variant only: reveal un-hit enemy ship positions (post-match). */
  reveal?: boolean;
  lastShot?: Coord | null;
  onCellActivate?: (row: number, col: number) => void;
  onCellEnter?: (row: number, col: number) => void;
  onCellLeave?: () => void;
  /** Render handlers for drag/drop on player placement board. */
  cellDnDProps?: (row: number, col: number) => React.HTMLAttributes<HTMLDivElement>;
}

const colLabel = (c: number) => String.fromCharCode(65 + c);
const cellLabel = (row: number, col: number) => `${colLabel(col)}${row + 1}`;

/** Per-cell visual state for the given board + variant. */
function deriveState(
  board: Board,
  variant: GridVariant,
  row: number,
  col: number,
  reveal = false,
) {
  const fired = board.shots.has(keyOf(row, col));
  const ship = board.ships.find((s) =>
    s.cells.some((c) => c.row === row && c.col === col),
  );

  if (variant === "player") {
    if (ship && fired) return ship.sunk ? "sunk" : "hit";
    if (fired) return "miss";
    if (ship) return "ship";
    return "empty";
  }
  // target variant — enemy ships stay hidden unless sunk (or revealed post-match)
  if (fired) {
    if (!ship) return "miss";
    return ship.sunk ? "sunk" : "hit";
  }
  if (reveal && ship) return "reveal"; // un-hit ship, shown after the match
  return "empty";
}

export default function Grid({
  variant,
  board,
  interactive = false,
  disabled = false,
  preview = null,
  selectedId = null,
  reveal = false,
  lastShot = null,
  onCellActivate,
  onCellEnter,
  onCellLeave,
  cellDnDProps,
}: GridProps) {
  const [focus, setFocus] = useState<Coord>({ row: 0, col: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  const previewSet = preview
    ? new Set(preview.cells.map((c) => keyOf(c.row, c.col)))
    : null;

  const selectedSet = selectedId
    ? new Set(
        board.ships
          .find((s) => s.id === selectedId)
          ?.cells.map((c) => keyOf(c.row, c.col)) ?? [],
      )
    : null;

  const focusCell = useCallback((row: number, col: number) => {
    const el = gridRef.current?.querySelector<HTMLElement>(
      `[data-cell="${row}-${col}"]`,
    );
    el?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      let r = row;
      let c = col;
      switch (e.key) {
        case "ArrowUp": r = Math.max(0, row - 1); break;
        case "ArrowDown": r = Math.min(BOARD_SIZE - 1, row + 1); break;
        case "ArrowLeft": c = Math.max(0, col - 1); break;
        case "ArrowRight": c = Math.min(BOARD_SIZE - 1, col + 1); break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (!disabled) onCellActivate?.(row, col);
          return;
        default:
          return;
      }
      e.preventDefault();
      setFocus({ row: r, col: c });
      focusCell(r, c);
    },
    [disabled, onCellActivate, focusCell],
  );

  return (
    <div className={`grid-wrap grid-wrap--${variant}`}>
      {/* column labels */}
      <div className="grid-labels grid-labels--col" aria-hidden>
        <span className="grid-corner" />
        {Array.from({ length: BOARD_SIZE }, (_, c) => (
          <span key={c} className="grid-label">{colLabel(c)}</span>
        ))}
      </div>

      <div className="grid-body">
        {/* row labels */}
        <div className="grid-labels grid-labels--row" aria-hidden>
          {Array.from({ length: BOARD_SIZE }, (_, r) => (
            <span key={r} className="grid-label">{r + 1}</span>
          ))}
        </div>

        <div
          ref={gridRef}
          className={`grid ${disabled ? "grid--disabled" : ""}`}
          role={interactive ? "grid" : "presentation"}
          aria-label={variant === "target" ? "Enemy targeting grid" : "Your fleet grid"}
        >
          {Array.from({ length: BOARD_SIZE }, (_, row) =>
            Array.from({ length: BOARD_SIZE }, (_, col) => {
              const state = deriveState(board, variant, row, col, reveal);
              const k = keyOf(row, col);
              const inPreview = previewSet?.has(k) ?? false;
              const isSelected = selectedSet?.has(k) ?? false;
              const isLast =
                lastShot && lastShot.row === row && lastShot.col === col;
              const isFocusTarget = focus.row === row && focus.col === col;

              const classes = [
                "cell",
                `cell--${state}`,
                inPreview ? (preview!.valid ? "cell--preview-ok" : "cell--preview-bad") : "",
                isSelected ? "cell--selected" : "",
                isLast ? "cell--last" : "",
              ]
                .filter(Boolean)
                .join(" ");

              const dnd = cellDnDProps?.(row, col) ?? {};

              return (
                <div
                  key={k}
                  data-cell={`${row}-${col}`}
                  className={classes}
                  role={interactive ? "gridcell" : undefined}
                  tabIndex={interactive ? (isFocusTarget ? 0 : -1) : undefined}
                  aria-label={
                    interactive
                      ? `${cellLabel(row, col)} — ${state === "empty" ? "unknown" : state}`
                      : undefined
                  }
                  aria-disabled={disabled || undefined}
                  onClick={
                    interactive && !disabled
                      ? () => onCellActivate?.(row, col)
                      : undefined
                  }
                  onMouseEnter={interactive ? () => onCellEnter?.(row, col) : undefined}
                  onMouseLeave={interactive ? () => onCellLeave?.() : undefined}
                  onFocus={interactive ? () => setFocus({ row, col }) : undefined}
                  onKeyDown={
                    interactive ? (e) => handleKeyDown(e, row, col) : undefined
                  }
                  {...dnd}
                >
                  <span className="cell-face" />
                  {state === "hit" && <span className="cell-mark cell-mark--hit" />}
                  {state === "sunk" && <span className="cell-mark cell-mark--sunk" />}
                  {state === "miss" && <span className="cell-mark cell-mark--miss" />}
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
