"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Grid, { type PreviewState } from "./Grid";
import { useGame } from "@/state/store";
import { FLEET, BOARD_SIZE } from "@/game/constants";
import { canPlace, shipCells } from "@/game/board";
import type { Coord, Orientation, ShipId } from "@/game/types";

interface HeldShip {
  id: ShipId;
  size: number;
  orientation: Orientation;
}

export default function Placement({ onSound }: { onSound?: (s: string) => void }) {
  const playerBoard = useGame((s) => s.playerBoard);
  const placementOrientation = useGame((s) => s.placementOrientation);
  const setPlacementOrientation = useGame((s) => s.setPlacementOrientation);
  const placePlayerShip = useGame((s) => s.placePlayerShip);
  const removePlayerShip = useGame((s) => s.removePlayerShip);
  const randomizePlayer = useGame((s) => s.randomizePlayer);
  const clearPlayerBoard = useGame((s) => s.clearPlayerBoard);
  const readyUp = useGame((s) => s.readyUp);

  // A ship "in hand" (lifted, following the cursor as a ghost), or null.
  const [held, setHeld] = useState<HeldShip | null>(null);
  // A ship already on the board that's selected — Rotate turns it in place.
  const [selectedId, setSelectedId] = useState<ShipId | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const gridHostRef = useRef<HTMLDivElement>(null);
  const heldRef = useRef<HeldShip | null>(null);
  heldRef.current = held;
  const lastHoverRef = useRef<Coord | null>(null);

  const placedIds = new Set(playerBoard.ships.map((s) => s.id));
  const allPlaced = placedIds.size === FLEET.length;

  /** Translate a client point to a board coordinate, or null if outside the grid. */
  const pointToCoord = useCallback((clientX: number, clientY: number): Coord | null => {
    const gridEl = gridHostRef.current?.querySelector<HTMLElement>(".grid");
    if (!gridEl) return null;
    const r = gridEl.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom)
      return null;
    const cell = r.width / BOARD_SIZE;
    const col = Math.floor((clientX - r.left) / cell);
    const row = Math.floor((clientY - r.top) / cell);
    return {
      row: Math.max(0, Math.min(BOARD_SIZE - 1, row)),
      col: Math.max(0, Math.min(BOARD_SIZE - 1, col)),
    };
  }, []);

  const showGhost = useCallback(
    (coord: Coord, ship: HeldShip) => {
      const cells = shipCells(coord.row, coord.col, ship.size, ship.orientation);
      const valid = canPlace(
        playerBoard.ships,
        coord.row,
        coord.col,
        ship.size,
        ship.orientation,
        ship.id,
      );
      setPreview({ cells, valid });
    },
    [playerBoard.ships],
  );

  // While a ship is in hand, the ghost follows the cursor/finger across the grid.
  useEffect(() => {
    if (!held) return;
    const move = (e: PointerEvent) => {
      const c = pointToCoord(e.clientX, e.clientY);
      if (c) {
        lastHoverRef.current = c;
        showGhost(c, held);
      } else {
        setPreview(null);
      }
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [held, pointToCoord, showGhost]);

  // ---- pick up a ship from the roster (or lift a placed one back into hand) ----
  const pickUp = (id: ShipId, size: number) => {
    if (placedIds.has(id)) removePlayerShip(id);
    const ship: HeldShip = { id, size, orientation: placementOrientation };
    heldRef.current = ship;
    setHeld(ship);
    setSelectedId(null);
    onSound?.("pickup");
    if (lastHoverRef.current) showGhost(lastHoverRef.current, ship);
  };

  // ---- click a grid cell: place the held ship, or select a placed one ----
  const onCellActivate = (row: number, col: number) => {
    const ship = heldRef.current;
    if (ship) {
      const ok = placePlayerShip(ship.id, row, col, ship.orientation);
      if (ok) {
        onSound?.("place");
        setHeld(null);
        setSelectedId(ship.id); // keep it selected so Rotate works in place
        setPreview(null);
      } else {
        onSound?.("error");
      }
      return;
    }
    // nothing in hand — selecting an existing ship targets it for rotation
    const existing = playerBoard.ships.find((s) =>
      s.cells.some((c) => c.row === row && c.col === col),
    );
    if (existing) {
      setSelectedId(existing.id);
      onSound?.("click");
    }
  };

  const onCellEnter = (row: number, col: number) => {
    lastHoverRef.current = { row, col };
    if (heldRef.current) showGhost({ row, col }, heldRef.current);
  };

  // ---- rotation: turns the held ghost, or the selected placed ship in place ----
  const rotatePlaced = (id: ShipId): boolean => {
    const ship = playerBoard.ships.find((s) => s.id === id);
    if (!ship) return false;
    const next: Orientation =
      ship.orientation === "horizontal" ? "vertical" : "horizontal";
    // Try the same anchor first, then nudge back so an edge ship still fits.
    const candidates: Coord[] = [{ row: ship.row, col: ship.col }];
    for (let i = 1; i < ship.size; i++) {
      candidates.push(
        next === "vertical"
          ? { row: ship.row - i, col: ship.col }
          : { row: ship.row, col: ship.col - i },
      );
    }
    for (const a of candidates) {
      if (a.row < 0 || a.col < 0) continue;
      if (canPlace(playerBoard.ships, a.row, a.col, ship.size, next, id)) {
        placePlayerShip(id, a.row, a.col, next);
        return true;
      }
    }
    return false;
  };

  const rotate = () => {
    const ship = heldRef.current;
    if (ship) {
      const next: Orientation =
        ship.orientation === "horizontal" ? "vertical" : "horizontal";
      const updated = { ...ship, orientation: next };
      heldRef.current = updated;
      setHeld(updated);
      setPlacementOrientation(next);
      if (lastHoverRef.current) showGhost(lastHoverRef.current, updated);
      onSound?.("click");
      return;
    }
    if (selectedId) {
      const ok = rotatePlaced(selectedId);
      onSound?.(ok ? "click" : "error");
      return;
    }
    // nothing held or selected — just flip the default for the next placement
    setPlacementOrientation(
      placementOrientation === "horizontal" ? "vertical" : "horizontal",
    );
    onSound?.("click");
  };

  // keep a live ref so the global 'R' handler never goes stale
  const rotateRef = useRef(rotate);
  rotateRef.current = rotate;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        rotateRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="screen placement">
      <header className="phase-head">
        <h2 className="phase-title">DEPLOY YOUR FLEET</h2>
        <p className="phase-hint">
          Tap a ship, then tap the grid to place · <kbd>R</kbd> or Rotate to turn
        </p>
      </header>

      <div className="placement-body">
        <div
          className="placement-grid"
          ref={gridHostRef}
          onMouseLeave={() => held && setPreview(null)}
        >
          <Grid
            variant="player"
            board={playerBoard}
            interactive
            preview={preview}
            selectedId={selectedId}
            onCellActivate={onCellActivate}
            onCellEnter={onCellEnter}
          />
        </div>

        <aside className="placement-side panel">
          <p className="tray-title">FLEET ROSTER</p>
          <ul className="ship-tray">
            {FLEET.map((s) => {
              const isPlaced = placedIds.has(s.id);
              const isHeld = held?.id === s.id;
              const isSelected = selectedId === s.id && !isHeld;
              return (
                <li
                  key={s.id}
                  className={`tray-ship ${isPlaced ? "tray-ship--placed" : ""} ${
                    isHeld ? "tray-ship--held" : ""
                  } ${isSelected ? "tray-ship--selected" : ""}`}
                  onClick={() => pickUp(s.id, s.size)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${s.name}, length ${s.size}${
                    isPlaced ? ", placed — click to move" : ", click to pick up"
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pickUp(s.id, s.size);
                    }
                  }}
                >
                  <span className="tray-ship-name">{s.name}</span>
                  <span className="tray-ship-cells" aria-hidden>
                    {Array.from({ length: s.size }, (_, i) => (
                      <i key={i} className="tray-pip" />
                    ))}
                  </span>
                  <span className="tray-ship-status">
                    {isHeld ? "◆ IN HAND" : isPlaced ? "✓ DEPLOYED" : `LEN ${s.size}`}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="placement-controls">
            <button className="btn btn--ghost" onClick={rotate}>↻ Rotate</button>
            <button
              className="btn btn--ghost"
              onClick={() => {
                randomizePlayer();
                setHeld(null);
                setSelectedId(null);
                setPreview(null);
                onSound?.("place");
              }}
            >
              ⚄ Randomize
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => {
                clearPlayerBoard();
                setHeld(null);
                setSelectedId(null);
                setPreview(null);
                onSound?.("click");
              }}
            >
              ✕ Clear
            </button>
          </div>

          <button
            className="btn btn--magenta btn--lg placement-ready"
            disabled={!allPlaced}
            onClick={() => { readyUp(); onSound?.("ready"); }}
          >
            {allPlaced ? "Engage ▸" : `Deploy ${FLEET.length - placedIds.size} more`}
          </button>
        </aside>
      </div>
    </div>
  );
}
