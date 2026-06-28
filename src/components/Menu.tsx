"use client";

import { useGame } from "@/state/store";
import type { Difficulty } from "@/game/types";

const DIFFICULTIES: { id: Difficulty; name: string; blurb: string; tag: string }[] = [
  { id: "easy", name: "Recruit", blurb: "Random salvos. A gentle voyage.", tag: "EASY" },
  { id: "medium", name: "Officer", blurb: "Hunts & targets your hull after a hit.", tag: "MEDIUM" },
  { id: "hard", name: "Admiral", blurb: "Probability tracking & parity sweeps. Merciless.", tag: "HARD" },
];

export default function Menu({ onStart }: { onStart: () => void }) {
  const difficulty = useGame((s) => s.difficulty);
  const setDifficulty = useGame((s) => s.setDifficulty);
  const startPlacement = useGame((s) => s.startPlacement);

  const begin = () => {
    onStart();
    startPlacement();
  };

  return (
    <div className="screen menu">
      <div className="menu-hero">
        <p className="menu-eyebrow">NAVAL TACTICAL COMBAT</p>
        <h1 className="menu-title" data-text="ARMADA">ARMADA</h1>
        <p className="menu-sub">
          Command your fleet. Read the deep. Sink them all.
        </p>
      </div>

      <div className="menu-diff">
        <p className="menu-diff-label">SELECT ENEMY AI</p>
        <div className="diff-grid">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              className={`diff-card ${difficulty === d.id ? "diff-card--active" : ""}`}
              onClick={() => setDifficulty(d.id)}
              aria-pressed={difficulty === d.id}
            >
              <span className="diff-tag">{d.tag}</span>
              <span className="diff-name">{d.name}</span>
              <span className="diff-blurb">{d.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn--lg btn--magenta menu-start" onClick={begin}>
        Deploy Fleet ▸
      </button>

      <p className="menu-foot">
        Classic Battleship · 10×10 · 5 ships · No power-ups
      </p>
    </div>
  );
}
