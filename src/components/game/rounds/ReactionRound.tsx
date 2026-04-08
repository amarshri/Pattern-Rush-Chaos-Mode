"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoundConfig, RoundResult } from "@/lib/game/types";
import { clamp, range } from "@/lib/utils";
import { mulberry32 } from "@/lib/game/rng";

const TARGET_SYMBOL = "X";
const DECOY_SYMBOLS = ["O", "#", "+"];

export const ReactionRound = ({
  round,
  onComplete,
}: {
  round: RoundConfig;
  onComplete: (result: RoundResult) => void;
}) => {
  const rng = useMemo(() => mulberry32(round.seed), [round.seed]);
  const size = clamp(Math.round(3 + round.difficulty.score * 0.18), 3, 5);
  const windowMs = round.timeLimitMs;
  const totalTargets = round.targetCount;

  const [activeIndex, setActiveIndex] = useState(0);
  const [decoys, setDecoys] = useState<number[]>([]);
  const [hitCount, setHitCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [reactionTotal, setReactionTotal] = useState(0);
  const appearTime = useRef<number>(0);
  const completedRef = useRef(false);

  const nextTarget = useCallback(() => {
    const next = Math.floor(rng() * size * size);
    const decoyCount = clamp(Math.round(round.difficulty.score * 0.3), 1, 4);
    const decoyIndexes: number[] = [];
    while (decoyIndexes.length < decoyCount) {
      const index = Math.floor(rng() * size * size);
      if (index !== next && !decoyIndexes.includes(index)) decoyIndexes.push(index);
    }
    setActiveIndex(next);
    setDecoys(decoyIndexes);
    appearTime.current = performance.now();
  }, [rng, round.difficulty.score, size]);

  useEffect(() => {
    nextTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMissCount((prev) => prev + 1);
      if (hitCount + missCount + 1 >= totalTargets) {
        if (completedRef.current) return;
        completedRef.current = true;
        const accuracy = hitCount / totalTargets;
        const avgReaction = hitCount > 0 ? reactionTotal / hitCount : windowMs;
        const score = Math.round(accuracy * 120 + clamp(1 - avgReaction / windowMs, 0, 1) * 60);
        onComplete({
          id: round.id,
          type: round.type,
          score,
          accuracy,
          reactionMs: avgReaction,
          success: accuracy > 0.6,
          notes: ["Target taps"],
        });
        return;
      }
      nextTarget();
    }, windowMs);

    return () => clearTimeout(timer);
  }, [hitCount, missCount, nextTarget, onComplete, reactionTotal, round, totalTargets, windowMs]);

  const handleTap = (index: number) => {
    if (index !== activeIndex) return;
    const reaction = performance.now() - appearTime.current;
    setReactionTotal((prev) => prev + reaction);
    setHitCount((prev) => prev + 1);

    if (hitCount + missCount + 1 >= totalTargets) {
      if (completedRef.current) return;
      completedRef.current = true;
      const accuracy = (hitCount + 1) / totalTargets;
      const avgReaction = (reactionTotal + reaction) / (hitCount + 1);
      const score = Math.round(accuracy * 120 + clamp(1 - avgReaction / windowMs, 0, 1) * 60);
      onComplete({
        id: round.id,
        type: round.type,
        score,
        accuracy,
        reactionMs: avgReaction,
        success: accuracy > 0.6,
        notes: ["Target taps"],
      });
      return;
    }
    nextTarget();
  };

  return (
    <div>
      <div
        className="grid w-full max-w-[90vw] max-h-[70vh] gap-2 rounded-3xl bg-white/5 p-3 lg:max-w-[min(70vh,55vw)] lg:max-h-[70vh]"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {range(size * size).map((index) => {
          const isTarget = index === activeIndex;
          const isDecoy = decoys.includes(index);
          return (
            <button
              key={index}
              onClick={() => handleTap(index)}
              className={
                "flex aspect-square items-center justify-center rounded-2xl border border-white/10 text-lg font-semibold transition " +
                (isTarget
                  ? "bg-rose-400/80 text-white shadow-lg"
                  : isDecoy
                    ? "bg-white/15 text-white/60"
                    : "bg-white/5 text-white/20")
              }
            >
              {isTarget ? TARGET_SYMBOL : isDecoy ? DECOY_SYMBOLS[index % DECOY_SYMBOLS.length] : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
};
