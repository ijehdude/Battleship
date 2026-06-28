"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { ShotResult } from "@/game/types";

export interface FxHandle {
  impact: (x: number, y: number, outcome: ShotResult["outcome"], big: boolean) => void;
  shake: (intensity: number) => void;
}

interface Particle {
  spr: import("pixi.js").Sprite;
  vx: number;
  vy: number;
  grav: number;
  life: number;
  maxLife: number;
  scale: number;
  spin: number;
}

interface Ring {
  gfx: import("pixi.js").Graphics;
  life: number;
  maxLife: number;
  maxR: number;
  color: number;
  width: number;
}

const COLORS = {
  hit: [0xffb13d, 0xff5a2c, 0xffd84a],
  sunk: [0xff5a2c, 0xffd84a, 0xff35d6],
  miss: [0x2fe6ff, 0x8df6ff, 0xffffff],
};

function makeCircleTexture(PIXI: typeof import("pixi.js"), app: import("pixi.js").Application) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return PIXI.Texture.from(canvas);
}

export default forwardRef<FxHandle, { reducedMotion: boolean }>(function FxLayer(
  { reducedMotion },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    PIXI: typeof import("pixi.js");
    app: import("pixi.js").Application;
    stage: import("pixi.js").Container;
    fxRoot: import("pixi.js").Container;
    tex: import("pixi.js").Texture;
    pool: import("pixi.js").Sprite[];
    particles: Particle[];
    rings: Ring[];
    shakeAmt: number;
  } | null>(null);
  const destroyedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    destroyedRef.current = false;

    (async () => {
      const PIXI = await import("pixi.js");
      if (cancelled || !hostRef.current) return;

      const app = new PIXI.Application();
      await app.init({
        resizeTo: window,
        backgroundAlpha: 0,
        antialias: true,
        powerPreference: "high-performance",
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      if (cancelled) {
        app.destroy(true);
        return;
      }
      hostRef.current.appendChild(app.canvas as HTMLCanvasElement);

      const fxRoot = new PIXI.Container();
      app.stage.addChild(fxRoot);
      const tex = makeCircleTexture(PIXI, app);

      const st = {
        PIXI,
        app,
        stage: app.stage,
        fxRoot,
        tex,
        pool: [] as import("pixi.js").Sprite[],
        particles: [] as Particle[],
        rings: [] as Ring[],
        shakeAmt: 0,
      };
      stateRef.current = st;

      app.ticker.add((ticker) => {
        const dt = Math.min(ticker.deltaMS, 50) / 16.667;

        // particles
        for (let i = st.particles.length - 1; i >= 0; i--) {
          const p = st.particles[i];
          p.life -= dt;
          if (p.life <= 0) {
            p.spr.visible = false;
            st.pool.push(p.spr);
            st.particles.splice(i, 1);
            continue;
          }
          p.vy += p.grav * dt;
          p.spr.x += p.vx * dt;
          p.spr.y += p.vy * dt;
          const k = p.life / p.maxLife;
          p.spr.alpha = k;
          p.spr.scale.set(p.scale * (0.4 + k * 0.8));
          p.spr.rotation += p.spin * dt;
        }

        // rings / shockwaves
        for (let i = st.rings.length - 1; i >= 0; i--) {
          const r = st.rings[i];
          r.life -= dt;
          if (r.life <= 0) {
            r.gfx.destroy();
            st.rings.splice(i, 1);
            continue;
          }
          const k = 1 - r.life / r.maxLife;
          const radius = r.maxR * (0.1 + k * 0.9);
          r.gfx.clear();
          r.gfx
            .circle(0, 0, radius)
            .stroke({ width: r.width * (1 - k * 0.7), color: r.color, alpha: (1 - k) * 0.9 });
        }

        // screen shake on the whole stage
        if (st.shakeAmt > 0.1) {
          fxRoot.x = (Math.random() - 0.5) * st.shakeAmt;
          fxRoot.y = (Math.random() - 0.5) * st.shakeAmt;
          st.shakeAmt *= 0.86;
        } else {
          fxRoot.x = 0;
          fxRoot.y = 0;
          st.shakeAmt = 0;
        }
      });
    })();

    return () => {
      cancelled = true;
      destroyedRef.current = true;
      const st = stateRef.current;
      if (st) {
        try {
          st.app.destroy(true, { children: true, texture: false });
        } catch {
          /* noop */
        }
        stateRef.current = null;
      }
    };
  }, []);

  const spawnParticle = (
    x: number,
    y: number,
    color: number,
    speed: number,
    grav: number,
    lifeFrames: number,
    scale: number,
  ) => {
    const st = stateRef.current;
    if (!st) return;
    const spr = st.pool.pop() ?? new st.PIXI.Sprite(st.tex);
    if (!spr.parent) st.fxRoot.addChild(spr);
    spr.visible = true;
    spr.anchor.set(0.5);
    spr.blendMode = "add";
    spr.tint = color;
    spr.x = x;
    spr.y = y;
    spr.alpha = 1;
    spr.scale.set(scale);
    const ang = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    st.particles.push({
      spr,
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v,
      grav,
      life: lifeFrames,
      maxLife: lifeFrames,
      scale,
      spin: (Math.random() - 0.5) * 0.3,
    });
  };

  const spawnRing = (x: number, y: number, color: number, maxR: number, width: number, life: number) => {
    const st = stateRef.current;
    if (!st) return;
    const gfx = new st.PIXI.Graphics();
    gfx.x = x;
    gfx.y = y;
    gfx.blendMode = "add";
    st.fxRoot.addChild(gfx);
    st.rings.push({ gfx, life, maxLife: life, maxR, color, width });
  };

  useImperativeHandle(ref, () => ({
    impact: (x, y, outcome, big) => {
      const st = stateRef.current;
      if (!st) return;

      if (outcome === "miss") {
        spawnRing(x, y, 0x2fe6ff, 46, 3, 36);
        if (!reducedMotion) {
          for (let i = 0; i < 10; i++) {
            const c = COLORS.miss[i % COLORS.miss.length];
            spawnParticle(x, y, c, 3.2, 0.12, 26 + Math.random() * 14, 0.28);
          }
        }
        return;
      }

      // hit or sunk
      const big2 = big || outcome === "sunk";
      const palette = outcome === "sunk" ? COLORS.sunk : COLORS.hit;
      spawnRing(x, y, 0xffd84a, big2 ? 120 : 70, big2 ? 6 : 4, big2 ? 46 : 34);
      if (big2) spawnRing(x, y, 0xff5a2c, 180, 4, 60);

      const count = reducedMotion ? 6 : big2 ? 46 : 24;
      for (let i = 0; i < count; i++) {
        const c = palette[i % palette.length];
        spawnParticle(
          x,
          y,
          c,
          big2 ? 7 : 4.5,
          0.18,
          (big2 ? 38 : 26) + Math.random() * 18,
          big2 ? 0.5 : 0.36,
        );
      }
      // bright core flash
      spawnParticle(x, y, 0xffffff, 0.4, 0, big2 ? 16 : 10, big2 ? 1.6 : 1.0);
    },
    shake: (intensity) => {
      const st = stateRef.current;
      if (!st || reducedMotion) return;
      st.shakeAmt = Math.max(st.shakeAmt, intensity);
    },
  }), [reducedMotion]);

  return <div className="fx-canvas" ref={hostRef} aria-hidden />;
});
