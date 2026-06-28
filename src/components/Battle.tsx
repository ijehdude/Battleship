"use client";

import { useEffect, useRef, useState } from "react";
import Grid from "./Grid";
import {
  FleetTracker,
  AccuracyStat,
  TurnIndicator,
  BattleLog,
  LastShotTicker,
} from "./Hud";
import { useGame } from "@/state/store";
import type { Coord } from "@/game/types";

type BattleView = "attack" | "defense";

export default function Battle({ onSound }: { onSound?: (s: string) => void }) {
  const playerBoard = useGame((s) => s.playerBoard);
  const enemyBoard = useGame((s) => s.enemyBoard);
  const turn = useGame((s) => s.turn);
  const busy = useGame((s) => s.busy);
  const humanStats = useGame((s) => s.humanStats);
  const aiStats = useGame((s) => s.aiStats);
  const humanStreak = useGame((s) => s.humanStreak);
  const log = useGame((s) => s.log);
  const fireAtEnemy = useGame((s) => s.fireAtEnemy);

  const [hover, setHover] = useState<Coord | null>(null);

  // Mobile single-board toggle (ignored by the side-by-side desktop layout).
  const [view, setView] = useState<BattleView>("attack");
  const [unseenDamage, setUnseenDamage] = useState(false);
  const prevAiHits = useRef(aiStats.hits);

  // Flag a pulse on the Defense tab when the AI lands a hit you haven't viewed.
  useEffect(() => {
    if (aiStats.hits > prevAiHits.current && view !== "defense") {
      setUnseenDamage(true);
    }
    prevAiHits.current = aiStats.hits;
  }, [aiStats.hits, view]);

  const switchView = (next: BattleView) => {
    setView(next);
    if (next === "defense") setUnseenDamage(false);
    onSound?.("click");
  };

  const canFire = turn === "human" && !busy;

  const fire = (row: number, col: number) => {
    if (!canFire) return;
    if (enemyBoard.shots.has(`${row},${col}`)) {
      onSound?.("error");
      return;
    }
    fireAtEnemy(row, col);
    // sound handled by FX layer reacting to fx event
  };

  return (
    <div className="screen battle">
      <header className="battle-top">
        <TurnIndicator turn={turn} busy={busy} />
        {humanStreak >= 2 && (
          <div className="streak-badge" key={humanStreak}>
            🔥 {humanStreak}× STREAK
          </div>
        )}
      </header>

      {/* Mobile-only view toggle + slim log ticker (hidden on desktop via CSS) */}
      <div className="battle-tabs" role="tablist" aria-label="Board view">
        <button
          role="tab"
          aria-selected={view === "attack"}
          className={`battle-tab battle-tab--attack ${view === "attack" ? "battle-tab--active" : ""}`}
          onClick={() => switchView("attack")}
        >
          ⌖ Attack
        </button>
        <button
          role="tab"
          aria-selected={view === "defense"}
          className={`battle-tab battle-tab--defense ${view === "defense" ? "battle-tab--active" : ""}`}
          onClick={() => switchView("defense")}
        >
          🛡 Defense
          {unseenDamage && <span className="tab-badge" aria-label="New damage" />}
        </button>
      </div>
      <LastShotTicker log={log} />

      <div className="battle-arena" data-view={view}>
        {/* Enemy / targeting grid */}
        <section className="board-col board-col--enemy">
          <div className="board-head">
            <h3 className="board-title board-title--enemy">ENEMY WATERS</h3>
            <AccuracyStat shots={humanStats.shots} hits={humanStats.hits} label="YOUR" />
          </div>
          <div className={`board-frame board-frame--target ${canFire ? "board-frame--armed" : ""}`}>
            <Grid
              variant="target"
              board={enemyBoard}
              interactive
              disabled={!canFire}
              onCellActivate={fire}
              onCellEnter={(r, c) => setHover({ row: r, col: c })}
              onCellLeave={() => setHover(null)}
              lastShot={hover}
            />
          </div>
          <FleetTracker board={enemyBoard} label="ENEMY FLEET" tone="enemy" />
        </section>

        {/* Center log on desktop */}
        <div className="battle-center">
          <BattleLog log={log} />
        </div>

        {/* Player / own fleet grid */}
        <section className="board-col board-col--player">
          <div className="board-head">
            <h3 className="board-title board-title--player">YOUR FLEET</h3>
            <AccuracyStat shots={aiStats.shots} hits={aiStats.hits} label="CPU" />
          </div>
          <div className="board-frame board-frame--player">
            <Grid variant="player" board={playerBoard} />
          </div>
          <FleetTracker board={playerBoard} label="YOUR FLEET" tone="ally" />
        </section>
      </div>
    </div>
  );
}
