"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudio, type SfxName } from "@/audio/engine";

const STORAGE_KEY = "armada-audio";

export function useAudio() {
  const [muted, setMutedState] = useState(false);
  const [volume, setVolumeState] = useState(0.7);
  const startedRef = useRef(false);

  // restore prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.muted === "boolean") setMutedState(p.muted);
        if (typeof p.volume === "number") setVolumeState(p.volume);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // unlock audio on first gesture (autoplay policy) + start ambient music
  useEffect(() => {
    const unlock = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const a = getAudio();
      a.ensure();
      a.setMuted(muted);
      a.setVolume(volume);
      if (!muted) a.startMusic();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [muted, volume]);

  const persist = (m: boolean, v: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ muted: m, volume: v }));
    } catch {
      /* ignore */
    }
  };

  const setMuted = useCallback(
    (m: boolean) => {
      setMutedState(m);
      getAudio().setMuted(m);
      if (!m && startedRef.current) getAudio().startMusic();
      persist(m, volume);
    },
    [volume],
  );

  const setVolume = useCallback(
    (v: number) => {
      setVolumeState(v);
      getAudio().setVolume(v);
      persist(muted, v);
    },
    [muted],
  );

  const play = useCallback((name: SfxName) => {
    if (!startedRef.current) return;
    getAudio().play(name);
  }, []);

  return { muted, setMuted, volume, setVolume, play };
}
