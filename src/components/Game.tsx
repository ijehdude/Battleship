"use client";

import { useCallback, useEffect, useRef } from "react";
import gsap from "gsap";
import { useGame } from "@/state/store";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAudio } from "@/hooks/useAudio";
import type { SfxName } from "@/audio/engine";
import Menu from "./Menu";
import Placement from "./Placement";
import Battle from "./Battle";
import Result from "./Result";
import FxLayer, { type FxHandle } from "./FxLayer";
import "@/styles/game.css";

/** Screen-space centre of a board cell, or null if not mounted. */
function cellCenter(side: "human" | "ai", row: number, col: number) {
  const frame = side === "human" ? ".board-frame--target" : ".board-frame--player";
  const el = document.querySelector(`${frame} [data-cell="${row}-${col}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export default function Game() {
  const phase = useGame((s) => s.phase);
  const fx = useGame((s) => s.fx);
  const turn = useGame((s) => s.turn);
  const finishing = useGame((s) => s.finishing);
  const winner = useGame((s) => s.winner);
  const runAiTurn = useGame((s) => s.runAiTurn);
  const concludeToResult = useGame((s) => s.concludeToResult);

  const reduced = useReducedMotion();
  const audio = useAudio();
  const fxRef = useRef<FxHandle>(null);
  const lastFxSeq = useRef(0);

  const sound = useCallback((s: string) => audio.play(s as SfxName), [audio]);

  // ---- react to each resolved shot: sound + particles + shake ----
  useEffect(() => {
    if (!fx || fx.seq === lastFxSeq.current) return;
    lastFxSeq.current = fx.seq;

    audio.play("fire");
    const outSound: SfxName =
      fx.outcome === "sunk" ? "sunk" : fx.outcome === "hit" ? "hit" : "miss";
    const tSound = window.setTimeout(() => audio.play(outSound), 150);

    const big = fx.finalBlow || fx.outcome === "sunk";
    const pos = cellCenter(fx.side, fx.coord.row, fx.coord.col);
    if (pos) fxRef.current?.impact(pos.x, pos.y, fx.outcome, big);

    if (fx.outcome === "hit") fxRef.current?.shake(7);
    if (big) fxRef.current?.shake(20);

    // DOM shake of the arena for tactile feedback
    if ((fx.outcome === "hit" || fx.outcome === "sunk") && !reduced) {
      const arena = document.querySelector<HTMLElement>(".battle-arena");
      if (arena) {
        gsap.fromTo(
          arena,
          { x: big ? -12 : -6 },
          { x: 0, duration: 0.55, ease: "elastic.out(1, 0.32)" },
        );
      }
    }

    return () => window.clearTimeout(tSound);
  }, [fx, audio, reduced]);

  // ---- AI turn driver (with a "thinking" delay) ----
  useEffect(() => {
    if (phase !== "battle" || turn !== "ai" || finishing) return;
    const id = window.setTimeout(() => runAiTurn(), reduced ? 280 : 720);
    return () => window.clearTimeout(id);
  }, [phase, turn, finishing, fx?.seq, runAiTurn, reduced]);

  // ---- killing-blow cinematic, then reveal the result ----
  useEffect(() => {
    if (!finishing) return;
    const won = winner === "human";
    document.body.classList.add("slowmo");
    const s1 = window.setTimeout(() => audio.play(won ? "victory" : "defeat"), 480);
    const s2 = window.setTimeout(
      () => {
        document.body.classList.remove("slowmo");
        concludeToResult();
      },
      reduced ? 500 : 1700,
    );
    return () => {
      window.clearTimeout(s1);
      window.clearTimeout(s2);
      document.body.classList.remove("slowmo");
    };
  }, [finishing, winner, audio, concludeToResult, reduced]);

  return (
    <>
      <FxLayer ref={fxRef} reducedMotion={reduced} />

      <SoundBar
        muted={audio.muted}
        volume={audio.volume}
        onToggle={() => audio.setMuted(!audio.muted)}
        onVolume={audio.setVolume}
      />

      <div className="phase-stage" data-phase={phase}>
        {phase === "menu" && <Menu onStart={() => sound("ready")} />}
        {phase === "placement" && <Placement onSound={sound} />}
        {(phase === "battle") && <Battle onSound={sound} />}
        {phase === "result" && <Result onSound={sound} />}
      </div>
    </>
  );
}

function SoundBar({
  muted,
  volume,
  onToggle,
  onVolume,
}: {
  muted: boolean;
  volume: number;
  onToggle: () => void;
  onVolume: (v: number) => void;
}) {
  return (
    <div className="sound-bar">
      <button
        className="sound-toggle"
        onClick={onToggle}
        aria-label={muted ? "Unmute" : "Mute"}
        aria-pressed={muted}
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <input
        className="sound-slider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        onChange={(e) => onVolume(parseFloat(e.target.value))}
        aria-label="Volume"
      />
    </div>
  );
}
