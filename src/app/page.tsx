"use client";

import dynamic from "next/dynamic";

// The whole game is client-side (Pixi, Web Audio, drag/drop). Load with no SSR
// to avoid hydration churn on the canvas layer.
const Game = dynamic(() => import("@/components/Game"), {
  ssr: false,
  loading: () => <div className="boot-screen">INITIALIZING ARMADA…</div>,
});

export default function Page() {
  return (
    <main>
      <Game />
    </main>
  );
}
