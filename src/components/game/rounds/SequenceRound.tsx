"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoundConfig, RoundResult } from "@/lib/game/types";
import { clamp, range } from "@/lib/utils";
import { mulberry32 } from "@/lib/game/rng";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const SYMBOLS = ["TRI", "SQ", "CIR", "DIA", "HEX"];

export const SequenceRound = ({
  round,
  onComplete,
}: {
  round: RoundConfig;
  onComplete: (result: RoundResult) => void;
}) => {
  const rng = useMemo(() => mulberry32(round.seed), [round.seed]);
  const sequenceLength = clamp(Math.round(3 + round.difficulty.score * 0.5), 3, 7);
  const showMs = Math.round(clamp(round.timeLimitMs * 0.45, 450, 1100));

  const fullSequence = useMemo(
    () => range(sequenceLength).map(() => SYMBOLS[Math.floor(rng() * SYMBOLS.length)]),
    [rng, sequenceLength],
  );

  const targetSequence = useMemo(() => {
    if (round.variation === "Reverse") return [...fullSequence].reverse();
    if (round.variation === "Odds Only") return fullSequence.filter((_, idx) => idx % 2 === 0);
    if (round.variation === "Evens Only") return fullSequence.filter((_, idx) => idx % 2 === 1);
    return fullSequence;
  }, [fullSequence, round.variation]);

  const [phase, setPhase] = useState<"show" | "input">("show");
  const [showIndex, setShowIndex] = useState(0);
  const [input, setInput] = useState<string[]>([]);
  const startRef = useRef<number>(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (phase !== "show") return;
    if (showIndex >= fullSequence.length) {
      const timer = setTimeout(() => {
        setPhase("input");
        startRef.current = performance.now();
      }, 350);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setShowIndex((prev) => prev + 1), showMs);
    return () => clearTimeout(timer);
  }, [fullSequence.length, phase, showIndex, showMs]);

  const handleTap = useCallback(
    (symbol: string) => {
      if (phase !== "input") return;
      const next = [...input, symbol];
      setInput(next);
      if (next.length >= targetSequence.length) {
        if (completedRef.current) return;
        completedRef.current = true;
        const reaction = performance.now() - startRef.current;
        const correct = targetSequence.filter((value, idx) => value === next[idx]).length;
        const accuracy = correct / targetSequence.length;
        const score = Math.round(accuracy * 130 + clamp(1 - reaction / (round.timeLimitMs + 600), 0, 1) * 40);
        onComplete({
          id: round.id,
          type: round.type,
          score,
          accuracy,
          reactionMs: reaction / targetSequence.length,
          success: accuracy > 0.7,
          notes: [round.variation],
        });
      }
    },
    [input, onComplete, phase, round, targetSequence],
  );

  const handleReset = () => setInput([]);

  return (
    <div>
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
        <span>{phase === "show" ? "Memorize" : "Repeat"}</span>
        <span>{round.variation}</span>
      </div>
      <div className="mt-6 rounded-2xl bg-white/5 p-6 text-center">
        {phase === "show" ? (
          <div className="text-3xl font-semibold tracking-[0.2em] text-white">
            {fullSequence[Math.min(showIndex, fullSequence.length - 1)]}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            {input.map((value, idx) => (
              <span key={`${value}-${idx}`} className="rounded-full bg-white/15 px-3 py-2 text-sm font-semibold">
                {value}
              </span>
            ))}
            {input.length === 0 && <span className="text-white/40">Tap to build</span>}
          </div>
        )}
      </div>
      {phase === "input" && (
        <div className="mt-5 grid grid-cols-3 gap-2">
          {SYMBOLS.map((symbol) => (
            <button
              key={symbol}
              onClick={() => handleTap(symbol)}
              className="rounded-2xl border border-white/10 bg-white/10 py-4 text-base font-semibold text-white hover:bg-white/20"
            >
              {symbol}
            </button>
          ))}
          <PrimaryButton onClick={handleReset} className="col-span-3 text-sm sm:text-base">
            Reset
          </PrimaryButton>
        </div>
      )}
    </div>
  );
};
