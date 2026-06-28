"use client";

import { FLEET } from "@/game/constants";
import type { Board, Player } from "@/game/types";
import type { LogEntry } from "@/state/store";

export function FleetTracker({
  board,
  label,
  tone,
}: {
  board: Board;
  label: string;
  tone: "ally" | "enemy";
}) {
  // Map sunk status by id (ships always exist on both boards once battle starts).
  const sunk = new Map(board.ships.map((s) => [s.id, s.sunk]));
  const remaining = FLEET.filter((f) => !sunk.get(f.id)).length;

  return (
    <div className={`fleet-tracker fleet-tracker--${tone}`}>
      <div className="fleet-tracker-head">
        <span className="fleet-tracker-label">{label}</span>
        <span className="fleet-tracker-count">{remaining}/{FLEET.length}</span>
      </div>
      <ul className="fleet-list">
        {FLEET.map((f) => {
          const isSunk = sunk.get(f.id) ?? false;
          return (
            <li key={f.id} className={`fleet-pip ${isSunk ? "fleet-pip--sunk" : ""}`}>
              <span className="fleet-pip-bar">
                {Array.from({ length: f.size }, (_, i) => (
                  <i key={i} />
                ))}
              </span>
              <span className="fleet-pip-name">{f.name}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AccuracyStat({
  shots,
  hits,
  label,
}: {
  shots: number;
  hits: number;
  label: string;
}) {
  const pct = shots === 0 ? 0 : Math.round((hits / shots) * 100);
  return (
    <div className="stat">
      <span className="stat-value">{pct}%</span>
      <span className="stat-label">{label} ACC</span>
      <span className="stat-sub">{hits}/{shots}</span>
    </div>
  );
}

export function TurnIndicator({ turn, busy }: { turn: Player; busy: boolean }) {
  return (
    <div className={`turn-indicator turn-indicator--${turn}`}>
      <span className="turn-dot" />
      <span className="turn-text">
        {turn === "human" ? "YOUR FIRE" : busy ? "ENEMY FIRING…" : "ENEMY TURN"}
      </span>
    </div>
  );
}

export function BattleLog({ log }: { log: LogEntry[] }) {
  const labelFor = (e: LogEntry) => {
    const coord = `${String.fromCharCode(65 + e.coord.col)}${e.coord.row + 1}`;
    switch (e.outcome) {
      case "hit": return `${coord} · HIT`;
      case "sunk": return `${coord} · SUNK ${e.shipName?.toUpperCase()}`;
      case "miss": return `${coord} · MISS`;
      default: return coord;
    }
  };
  return (
    <div className="battle-log panel">
      <p className="battle-log-title">COMBAT LOG</p>
      <ul className="battle-log-list">
        {log.length === 0 && <li className="log-empty">Awaiting first salvo…</li>}
        {log.map((e) => (
          <li key={e.id} className={`log-row log-row--${e.side} log-row--${e.outcome}`}>
            <span className="log-side">{e.side === "human" ? "YOU" : "CPU"}</span>
            <span className="log-text">{labelFor(e)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
