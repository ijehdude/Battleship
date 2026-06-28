"use client";

import { useState } from "react";
import Grid from "./Grid";
import { FleetTracker, BattleLog } from "./Hud";
import ViewTabs, { type ViewId, formatDuration } from "./ViewTabs";
import { useGame } from "@/state/store";
import { FLEET } from "@/game/constants";

export default function Result({ onSound }: { onSound?: (s: string) => void }) {
  const winner = useGame((s) => s.winner);
  const humanStats = useGame((s) => s.humanStats);
  const aiStats = useGame((s) => s.aiStats);
  const difficulty = useGame((s) => s.difficulty);
  const enemyBoard = useGame((s) => s.enemyBoard);
  const playerBoard = useGame((s) => s.playerBoard);
  const log = useGame((s) => s.log);
  const bestHitStreak = useGame((s) => s.bestHitStreak);
  const humanLongestMiss = useGame((s) => s.humanLongestMiss);
  const aiLongestMiss = useGame((s) => s.aiLongestMiss);
  const startedAt = useGame((s) => s.startedAt);
  const endedAt = useGame((s) => s.endedAt);
  const rematch = useGame((s) => s.rematch);
  const backToMenu = useGame((s) => s.backToMenu);

  const [view, setView] = useState<ViewId>("attack");

  const won = winner === "human";
  const acc = (s: { shots: number; hits: number }) =>
    s.shots === 0 ? 0 : Math.round((s.hits / s.shots) * 100);

  const duration = formatDuration(startedAt && endedAt ? endedAt - startedAt : null);
  const enemySunkByYou = enemyBoard.ships.filter((s) => s.sunk).length;
  const yourShipsLost = playerBoard.ships.filter((s) => s.sunk).length;

  const compare: { label: string; you: string; cpu: string }[] = [
    { label: "Shots fired", you: `${humanStats.shots}`, cpu: `${aiStats.shots}` },
    { label: "Accuracy", you: `${acc(humanStats)}%`, cpu: `${acc(aiStats)}%` },
    { label: "Longest miss streak", you: `${humanLongestMiss}`, cpu: `${aiLongestMiss}` },
    { label: "Ships sunk", you: `${enemySunkByYou}/${FLEET.length}`, cpu: `${yourShipsLost}/${FLEET.length}` },
  ];

  return (
    <div className={`screen result result--${won ? "win" : "lose"}`}>
      <div className="result-card">
        <p className="result-eyebrow">{difficulty.toUpperCase()} ENGAGEMENT · COMPLETE</p>
        <h1 className="result-title" data-text={won ? "VICTORY" : "DEFEAT"}>
          {won ? "VICTORY" : "DEFEAT"}
        </h1>
        <p className="result-sub">
          {won
            ? "The enemy armada lies beneath the waves."
            : "Your fleet has been lost to the deep."}
        </p>

        {/* headline trivia */}
        <div className="result-headline">
          <div className="result-stat">
            <span className="result-stat-val">{duration}</span>
            <span className="result-stat-label">MATCH TIME</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-val">{bestHitStreak}×</span>
            <span className="result-stat-label">BEST HIT STREAK</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-val">{acc(humanStats)}%</span>
            <span className="result-stat-label">YOUR ACCURACY</span>
          </div>
        </div>

        {/* YOU vs CPU scoreboard */}
        <div className="result-compare">
          <div className="result-compare-head">
            <span className="rc-label">STAT</span>
            <span className="rc-you">YOU</span>
            <span className="rc-cpu">CPU</span>
          </div>
          {compare.map((r) => (
            <div className="result-compare-row" key={r.label}>
              <span className="rc-label">{r.label}</span>
              <span className="rc-you">{r.you}</span>
              <span className="rc-cpu">{r.cpu}</span>
            </div>
          ))}
        </div>

        {/* board / log review */}
        <div className="result-review">
          <ViewTabs
            className="result-tabs"
            ariaLabel="Match review"
            active={view}
            onChange={(v) => { setView(v); onSound?.("click"); }}
            tabs={[
              { id: "attack", label: "⌖ Attack" },
              { id: "defense", label: "🛡 Defense" },
              { id: "log", label: "☰ Log" },
            ]}
          />
          <div className="result-review-body">
            {view === "attack" && (
              <div className="result-board">
                <div className="board-frame board-frame--target">
                  <Grid variant="target" board={enemyBoard} reveal />
                </div>
                <FleetTracker board={enemyBoard} label="ENEMY FLEET" tone="enemy" />
              </div>
            )}
            {view === "defense" && (
              <div className="result-board">
                <div className="board-frame board-frame--player">
                  <Grid variant="player" board={playerBoard} />
                </div>
                <FleetTracker board={playerBoard} label="YOUR FLEET" tone="ally" />
              </div>
            )}
            {view === "log" && <BattleLog log={log} />}
          </div>
        </div>

        <div className="result-actions">
          <button
            className="btn btn--magenta btn--lg"
            onClick={() => { rematch(); onSound?.("ready"); }}
          >
            ⟳ Rematch
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => { backToMenu(); onSound?.("click"); }}
          >
            ◂ Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
