"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoundConfig, RoundResult } from "@/lib/game/types";
import { clamp, range } from "@/lib/utils";
import { mulberry32 } from "@/lib/game/rng";

const COLORS = [
  { name: "RED", value: "#ff4d6d" },
  { name: "BLUE", value: "#4dabf7" },
  { name: "GREEN", value: "#4cd964" },
  { name: "YELLOW", value: "#ffd166" },
];

export const ColorRound = ({
  round,
  onComplete,
}: {
  round: RoundConfig;
  onComplete: (result: RoundResult) => void;
}) => {
  const rng = useMemo(() => mulberry32(round.seed), [round.seed]);
  const totalPrompts = clamp(Math.round(5 + round.difficulty.score * 0.6), 5, 9);
  const timePerPrompt = round.timeLimitMs;
  const switchIndex = round.variation === "Switch Rule" ? Math.floor(totalPrompts / 2) : -1;

  const prompts = useMemo(
    () =>
      range(totalPrompts).map(() => {
        const word = COLORS[Math.floor(rng() * COLORS.length)];
        const color = COLORS[Math.floor(rng() * COLORS.length)];
        return { word, color };
      }),
    [rng, totalPrompts],
  );

  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [reactionTotal, setReactionTotal] = useState(0);
  const promptStart = useRef<number>(0);
  const completedRef = useRef(false);

  const currentRule =
    round.variation === "Color Rule"
      ? "COLOR"
      : round.variation === "Text Rule"
        ? "TEXT"
        : index >= switchIndex && switchIndex >= 0
          ? "COLOR"
          : "TEXT";

  const handleAnswer = useCallback(
    (answer: string) => {
      const prompt = prompts[index];
      if (!prompt) return;
      const correct = currentRule === "COLOR" ? prompt.color.name === answer : prompt.word.name === answer;
      const reaction = Math.max(120, performance.now() - promptStart.current);
      setReactionTotal((prev) => prev + reaction);
      setCorrectCount((prev) => prev + (correct ? 1 : 0));

      if (index + 1 >= prompts.length) {
        if (completedRef.current) return;
        completedRef.current = true;
        const accuracy = (correctCount + (correct ? 1 : 0)) / prompts.length;
        const avgReaction = (reactionTotal + reaction) / prompts.length;
        const score = Math.round(accuracy * 140 + clamp(1 - avgReaction / timePerPrompt, 0, 1) * 50);
        onComplete({
          id: round.id,
          type: round.type,
          score,
          accuracy,
          reactionMs: avgReaction,
          success: accuracy > 0.7,
          notes: [currentRule],
        });
        return;
      }

      setIndex((prev) => prev + 1);
      promptStart.current = performance.now();
    },
    [correctCount, currentRule, index, onComplete, prompts, reactionTotal, round, timePerPrompt],
  );

  useEffect(() => {
    promptStart.current = performance.now();
    const end = performance.now() + timePerPrompt;
    const timer = setInterval(() => {
      const remaining = end - performance.now();
      if (remaining <= 0) {
        clearInterval(timer);
        handleAnswer("TIMEOUT");
      }
    }, 100);
    return () => clearInterval(timer);
  }, [handleAnswer, timePerPrompt, index]);

  const prompt = prompts[index];

  return (
    <div>
      <div className="rounded-2xl bg-white/5 p-6 text-center">
        <div
          className="text-4xl font-bold tracking-[0.2em]"
          style={{ color: prompt?.color.value }}
        >
          {prompt?.word.name}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {COLORS.map((color) => (
          <button
            key={color.name}
            onClick={() => handleAnswer(color.name)}
            className="rounded-2xl border border-white/10 bg-white/10 py-4 text-base font-semibold text-white hover:bg-white/20"
          >
            {color.name}
          </button>
        ))}
      </div>
    </div>
  );
};
