import { clamp } from "@/lib/utils";
import type { AdaptiveState, RoundResult } from "@/lib/game/types";

export const createAdaptiveState = (): AdaptiveState => ({
  skill: 0,
  streak: 0,
  lastResults: [],
});

export const updateAdaptiveState = (
  state: AdaptiveState,
  result: RoundResult,
): AdaptiveState => {
  const performance = result.accuracy * 0.7 + clamp(1 - result.reactionMs / 2500, 0, 1) * 0.3;
  const delta = (performance - 0.6) * 0.35 + (result.success ? 0.05 : -0.08);
  const skill = clamp(state.skill + delta, -1, 1);
  const streak = result.success ? state.streak + 1 : Math.max(0, state.streak - 1);
  const lastResults = [...state.lastResults, result].slice(-6);

  return { skill, streak, lastResults };
};
