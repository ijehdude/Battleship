"use client";

import { useGame } from "@/state/store";
import { FLEET } from "@/game/constants";

export default function Result({ onSound }: { onSound?: (s: string) => void }) {
  const winner = useGame((s) => s.winner);
  const humanStats = useGame((s) => s.humanStats);
  const aiStats = useGame((s) => s.aiStats);
  const difficulty = useGame((s) => s.difficulty);
  const enemyBoard = useGame((s) => s.enemyBoard);
  const playerBoard = useGame((s) => s.playerBoard);
  const rematch = useGame((s) => s.rematch);
  const backToMenu = useGame((s) => s.backToMenu);

  const won = winner === "human";
  const acc = (s: { shots: number; hits: number }) =>
    s.shots === 0 ? 0 : Math.round((s.hits / s.shots) * 100);

  const enemyShipsLeft = enemyBoard.ships.filter((s) => !s.sunk).length;
  const yourShipsLeft = playerBoard.ships.filter((s) => !s.sunk).length;

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

        <div className="result-stats">
          <div className="result-stat">
            <span className="result-stat-val">{humanStats.shots}</span>
            <span className="result-stat-label">SHOTS FIRED</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-val">{acc(humanStats)}%</span>
            <span className="result-stat-label">YOUR ACCURACY</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-val">{acc(aiStats)}%</span>
            <span className="result-stat-label">CPU ACCURACY</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-val">
              {won ? `${yourShipsLeft}/${FLEET.length}` : `${enemyShipsLeft}/${FLEET.length}`}
            </span>
            <span className="result-stat-label">
              {won ? "FLEET SURVIVING" : "ENEMY REMAINING"}
            </span>
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
