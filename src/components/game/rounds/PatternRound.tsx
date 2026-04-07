"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mulberry32 } from "@/lib/game/rng";
import type { RoundConfig, RoundResult } from "@/lib/game/types";
import { clamp, range } from "@/lib/utils";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const transformIndex = (index: number, size: number, variation: string) => {
  const row = Math.floor(index / size);
  const col = index % size;
  if (variation === "Mirrored") {
    return row * size + (size - 1 - col);
  }
  if (variation === "Rotated") {
    return (size - 1 - col) * size + row;
  }
  return index;
};

export const PatternRound = ({
  round,
  onComplete,
}: {
  round: RoundConfig;
  onComplete: (result: RoundResult) => void;
}) => {
  const rng = useMemo(() => mulberry32(round.seed), [round.seed]);
  const size = clamp(Math.round(3 + round.difficulty.score * 0.25), 3, 6);
  const previewMs = Math.round(clamp(round.timeLimitMs * 0.6, 1200, 2600));
  const maxTiles = size * size - 2;
  const patternSize = clamp(Math.round(3 + round.difficulty.score * 0.9), 4, maxTiles);

  const pattern = useMemo(() => {
    const indices = range(size * size);
    for (let i = indices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, patternSize).map((value) => transformIndex(value, size, round.variation));
  }, [patternSize, rng, round.variation, size]);

  const [phase, setPhase] = useState<"preview" | "input">("preview");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(round.timeLimitMs);
  const inputStart = useRef<number | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setPhase("input"), previewMs);
    return () => clearTimeout(timer);
  }, [previewMs]);

  useEffect(() => {
    if (phase !== "input") return;
    inputStart.current = performance.now();
    const end = performance.now() + round.timeLimitMs;
    const interval = setInterval(() => {
      const remaining = end - performance.now();
      setTimeLeft(Math.max(0, Math.round(remaining)));
      if (remaining <= 0) {
        clearInterval(interval);
        handleSubmit();
      }
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const toggle = useCallback(
    (index: number) => {
      if (phase !== "input") return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next;
      });
    },
    [phase],
  );

  const handleSubmit = useCallback(() => {
    if (phase !== "input") return;
    if (submittedRef.current) return;
    submittedRef.current = true;
    const correct = pattern.filter((value) => selected.has(value)).length;
    const falsePositives = Array.from(selected).filter((value) => !pattern.includes(value)).length;
    const accuracy = clamp((correct - falsePositives * 0.5) / pattern.length, 0, 1);
    const reactionMs = Math.max(200, performance.now() - (inputStart.current ?? performance.now()));
    const score = Math.round(accuracy * 120 + clamp(1 - reactionMs / round.timeLimitMs, 0, 1) * 40);

    onComplete({
      id: round.id,
      type: round.type,
      score,
      accuracy,
      reactionMs,
      success: accuracy > 0.7,
      notes: ["Pattern"],
    });
  }, [phase, pattern, round, selected, onComplete]);

  return (
    <div>
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
        <span>{phase === "preview" ? "Preview" : "Rebuild"}</span>
        <span>{(timeLeft / 1000).toFixed(1)}s</span>
      </div>
      <div
        className={
          "mt-4 grid w-full max-w-[90vw] max-h-[80vh] gap-2 rounded-3xl bg-white/5 p-3 transition lg:max-h-full lg:max-w-full " +
          (round.variation === "Fading" ? "animate-pulse" : "")
        }
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {range(size * size).map((index) => {
          const isActive = pattern.includes(index);
          const isSelected = selected.has(index);
          return (
            <button
              key={index}
              onClick={() => toggle(index)}
              className={
                "aspect-square rounded-xl border border-white/10 transition " +
                (phase === "preview" && isActive
                  ? "bg-white/80"
                  : isSelected
                    ? "bg-cyan-300/80"
                    : "bg-white/5 hover:bg-white/15")
              }
            />
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-white/60">Tap tiles to match the pattern.</p>
        <PrimaryButton onClick={handleSubmit} className="text-sm sm:text-base">
          Lock In
        </PrimaryButton>
      </div>
    </div>
  );
};
