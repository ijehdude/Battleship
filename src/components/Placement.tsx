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

  const [held, setHeld] = useState<HeldShip | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const gridHostRef = useRef<HTMLDivElement>(null);
  const heldRef = useRef<HeldShip | null>(null);
  heldRef.current = held;

  const placedIds = new Set(playerBoard.ships.map((s) => s.id));
  const allPlaced = placedIds.size === FLEET.length;

  /** Translate a client point to a board coordinate, or null if outside. */
  const pointToCoord = useCallback((clientX: number, clientY: number): Coord | null => {
    const gridEl = gridHostRef.current?.querySelector<HTMLElement>(".grid");
    if (!gridEl) return null;
    const r = gridEl.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom)
      return null;
    const cell = r.width / BOARD_SIZE;
    const col = Math.floor((clientX - r.left) / cell);
    const row = Math.floor((clientY - r.top) / cell);
    return { row: Math.max(0, Math.min(BOARD_SIZE - 1, row)), col: Math.max(0, Math.min(BOARD_SIZE - 1, col)) };
  }, []);

  const updatePreview = useCallback(
    (clientX: number, clientY: number) => {
      const ship = heldRef.current;
      if (!ship) return;
      const c = pointToCoord(clientX, clientY);
      if (!c) {
        setPreview(null);
        return;
      }
      const cells = shipCells(c.row, c.col, ship.size, ship.orientation);
      const valid = canPlace(playerBoard.ships, c.row, c.col, ship.size, ship.orientation, ship.id);
      setPreview({ cells, valid });
    },
    [pointToCoord, playerBoard.ships],
  );

  const drop = useCallback(
    (clientX: number, clientY: number) => {
      const ship = heldRef.current;
      if (!ship) return;
      const c = pointToCoord(clientX, clientY);
      if (c) {
        const ok = placePlayerShip(ship.id, c.row, c.col, ship.orientation);
        if (ok) onSound?.("place");
        else onSound?.("error");
      }
      setHeld(null);
      setPreview(null);
    },
    [pointToCoord, placePlayerShip, onSound],
  );

  // window-level pointer listeners while a ship is held
  useEffect(() => {
    if (!held) return;
    const move = (e: PointerEvent) => {
      e.preventDefault();
      updatePreview(e.clientX, e.clientY);
    };
    const up = (e: PointerEvent) => drop(e.clientX, e.clientY);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [held, updatePreview, drop]);

  // 'R' rotates the held ship; rotate also the default orientation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r") {
        rotate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held, placementOrientation]);

  const rotate = () => {
    const next: Orientation =
      placementOrientation === "horizontal" ? "vertical" : "horizontal";
    setPlacementOrientation(next);
    onSound?.("click");
    if (heldRef.current) {
      const updated = { ...heldRef.current, orientation: next };
      heldRef.current = updated;
      setHeld(updated);
    }
  };

  const beginDrag = (id: ShipId, size: number, e: React.PointerEvent) => {
    e.preventDefault();
    // picking up an already-placed ship frees its cells
    if (placedIds.has(id)) removePlayerShip(id);
    const ship: HeldShip = { id, size, orientation: placementOrientation };
    heldRef.current = ship;
    setHeld(ship);
    updatePreview(e.clientX, e.clientY);
    onSound?.("pickup");
  };

  // accessible click-to-place: clicking a cell drops the held ship there
  const onCellActivate = (row: number, col: number) => {
    const ship = heldRef.current;
    if (!ship) return;
    const ok = placePlayerShip(ship.id, row, col, ship.orientation);
    if (ok) {
      onSound?.("place");
      setHeld(null);
      setPreview(null);
    } else onSound?.("error");
  };

  const onCellEnter = (row: number, col: number) => {
    const ship = heldRef.current;
    if (!ship) return;
    const cells = shipCells(row, col, ship.size, ship.orientation);
    const valid = canPlace(playerBoard.ships, row, col, ship.size, ship.orientation, ship.id);
    setPreview({ cells, valid });
  };

  return (
    <div className="screen placement">
      <header className="phase-head">
        <h2 className="phase-title">DEPLOY YOUR FLEET</h2>
        <p className="phase-hint">
          Drag ships onto the grid · <kbd>R</kbd> or Rotate to turn · tap a placed ship to move it
        </p>
      </header>

      <div className="placement-body">
        <div className="placement-grid" ref={gridHostRef}>
          <Grid
            variant="player"
            board={playerBoard}
            interactive={!!held}
            preview={preview}
            onCellActivate={onCellActivate}
            onCellEnter={onCellEnter}
            onCellLeave={() => held && setPreview(null)}
          />
        </div>

        <aside className="placement-side panel">
          <p className="tray-title">FLEET ROSTER</p>
          <ul className="ship-tray">
            {FLEET.map((s) => {
              const isPlaced = placedIds.has(s.id);
              const isHeld = held?.id === s.id;
              return (
                <li
                  key={s.id}
                  className={`tray-ship ${isPlaced ? "tray-ship--placed" : ""} ${isHeld ? "tray-ship--held" : ""}`}
                  onPointerDown={(e) => beginDrag(s.id, s.size, e)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${s.name}, length ${s.size}${isPlaced ? ", placed" : ", in dock"}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      // keyboard pickup: select for click-to-place
                      if (isPlaced) removePlayerShip(s.id);
                      const ship = { id: s.id, size: s.size, orientation: placementOrientation };
                      heldRef.current = ship;
                      setHeld(ship);
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
                    {isPlaced ? "✓ DEPLOYED" : `LEN ${s.size}`}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="placement-controls">
            <button className="btn btn--ghost" onClick={rotate}>↻ Rotate</button>
            <button className="btn btn--ghost" onClick={() => { randomizePlayer(); onSound?.("place"); }}>
              ⚄ Randomize
            </button>
            <button className="btn btn--ghost" onClick={() => { clearPlayerBoard(); onSound?.("click"); }}>
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
