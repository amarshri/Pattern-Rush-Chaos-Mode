"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoundConfig, RoundResult } from "@/lib/game/types";
import { clamp, range } from "@/lib/utils";
import { mulberry32 } from "@/lib/game/rng";

const SYMBOLS = ["ALPHA", "BETA", "GAMMA", "DELTA", "OMEGA", "SIGMA"];

export const MultiRound = ({
  round,
  onComplete,
}: {
  round: RoundConfig;
  onComplete: (result: RoundResult) => void;
}) => {
  const rng = useMemo(() => mulberry32(round.seed), [round.seed]);
  const memoryCount = clamp(Math.round(2 + round.difficulty.score * 0.35), 2, 4);
  const promptCount = clamp(Math.round(6 + round.difficulty.score * 0.5), 6, 10);
  const promptWindow = round.timeLimitMs;

  const memorySet = useMemo(() => {
    const shuffled = [...SYMBOLS].sort(() => rng() - 0.5);
    return shuffled.slice(0, memoryCount);
  }, [memoryCount, rng]);

  const prompts = useMemo(
    () => range(promptCount).map(() => SYMBOLS[Math.floor(rng() * SYMBOLS.length)]),
    [promptCount, rng],
  );

  const [phase, setPhase] = useState<"preview" | "input">("preview");
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [reactionTotal, setReactionTotal] = useState(0);
  const promptStart = useRef<number>(0);
  const completedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase("input");
      promptStart.current = performance.now();
    }, 1400);
    return () => clearTimeout(timer);
  }, []);

  const handleChoice = useCallback(
    (choice: "SAFE" | "PASS") => {
      if (phase !== "input") return;
      const symbol = prompts[index];
      const isSafe = memorySet.includes(symbol);
      const isCorrect = (choice === "SAFE" && isSafe) || (choice === "PASS" && !isSafe);
      const reaction = performance.now() - promptStart.current;
      setReactionTotal((prev) => prev + reaction);
      setCorrect((prev) => prev + (isCorrect ? 1 : 0));

      if (index + 1 >= prompts.length) {
        if (completedRef.current) return;
        completedRef.current = true;
        const accuracy = (correct + (isCorrect ? 1 : 0)) / prompts.length;
        const avgReaction = (reactionTotal + reaction) / prompts.length;
        const score = Math.round(accuracy * 150 + clamp(1 - avgReaction / promptWindow, 0, 1) * 50);
        onComplete({
          id: round.id,
          type: round.type,
          score,
          accuracy,
          reactionMs: avgReaction,
          success: accuracy > 0.65,
          notes: ["Multi"],
        });
        return;
      }
      setIndex((prev) => prev + 1);
      promptStart.current = performance.now();
    },
    [correct, index, memorySet, onComplete, phase, promptWindow, prompts, reactionTotal, round],
  );

  useEffect(() => {
    if (phase !== "input") return;
    const timer = setTimeout(() => {
      handleChoice("PASS");
    }, promptWindow);
    return () => clearTimeout(timer);
  }, [handleChoice, phase, promptWindow, index]);

  return (
    <div>
      <div className="rounded-2xl bg-white/5 p-4">
        <div className="flex flex-wrap gap-2">
          {memorySet.map((symbol) => (
            <span key={symbol} className="rounded-full bg-white/15 px-3 py-2 text-xs font-semibold text-white">
              {symbol}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-6 rounded-2xl bg-white/5 p-6 text-center">
        {phase === "preview" ? (
          <p className="text-white/60">Memorize the safe set.</p>
        ) : (
          <div className="text-3xl font-semibold tracking-[0.2em] text-white">
            {prompts[index]}
          </div>
        )}
      </div>
      {phase === "input" && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => handleChoice("SAFE")}
            className="rounded-2xl border border-white/10 bg-emerald-400/80 py-4 text-base font-semibold text-emerald-950"
          >
            SAFE
          </button>
          <button
            onClick={() => handleChoice("PASS")}
            className="rounded-2xl border border-white/10 bg-white/10 py-4 text-base font-semibold text-white"
          >
            PASS
          </button>
        </div>
      )}
    </div>
  );
};
