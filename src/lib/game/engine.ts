import { clamp, pick, shuffle } from "@/lib/utils";
import { createSeed, mulberry32 } from "@/lib/game/rng";
import type { AdaptiveState, DifficultySnapshot, LevelConfig, RoundConfig, RoundType } from "@/lib/game/types";

const ROUND_POOL: RoundType[] = ["pattern", "color", "sequence", "reaction", "multi"];

const ROUND_META: Record<RoundType, { label: string; intros: string[]; rules: string[] }> = {
  pattern: {
    label: "Pattern Recall",
    intros: [
      "Memorize the glowing grid and recreate it.",
      "Lock the pattern in your head, then rebuild it.",
    ],
    rules: ["Tap tiles to match the pattern.", "Exact positions matter."],
  },
  color: {
    label: "Color Confusion",
    intros: [
      "Follow the rule: text or color.",
      "Stay sharp, the rule may switch mid-round.",
    ],
    rules: ["Answer based on the rule only.", "Speed and accuracy count."],
  },
  sequence: {
    label: "Sequence Memory",
    intros: [
      "Watch the sequence, then repeat it.",
      "Order matters. Sometimes in reverse.",
    ],
    rules: ["Repeat the sequence precisely.", "Some rounds filter even/odd items."],
  },
  reaction: {
    label: "Reaction Trap",
    intros: [
      "Tap the target symbols, ignore decoys.",
      "Fast reactions win this round.",
    ],
    rules: ["Only tap the target symbol.", "Misses cost accuracy."],
  },
  multi: {
    label: "Multi-Task Surge",
    intros: [
      "Remember the set, then tap only the safe targets.",
      "Memory plus speed: keep both active.",
    ],
    rules: ["Tap only symbols from the memory set.", "Decoys are dangerous."],
  },
};

const makeDifficulty = (
  levelIndex: number,
  adaptive: AdaptiveState,
  slot: number,
  total: number,
): DifficultySnapshot => {
  const stage = slot / Math.max(1, total - 1);
  const base = 1 + levelIndex * 0.55 + stage * 2.1;
  const score = clamp(base + adaptive.skill * 1.8, 1, 10);
  const speedFactor = clamp(1 - score * 0.055, 0.35, 1);
  const complexity = clamp(0.45 + score * 0.08 + stage * 0.2, 0.45, 1.25);
  return { level: levelIndex, score, speedFactor, complexity };
};

const variationByType = (type: RoundType, rng: () => number) => {
  const variations: Record<RoundType, string[]> = {
    pattern: ["Mirrored", "Rotated", "Fading", "Offset Grid"],
    color: ["Text Rule", "Color Rule", "Switch Rule"],
    sequence: ["Forward", "Reverse", "Odds Only", "Evens Only"],
    reaction: ["Fast Pulse", "Double Decoys", "Chaos Drift"],
    multi: ["Memory Fuse", "Dual Focus", "Pulse Filter"],
  };
  return pick(variations[type], rng);
};

const ruleByType = (type: RoundType, variation: string) => {
  switch (type) {
    case "pattern":
      return variation === "Mirrored"
        ? "Rebuild the mirrored pattern."
        : variation === "Rotated"
          ? "Rebuild the rotated pattern."
          : "Rebuild the shown pattern.";
    case "color":
      return variation === "Color Rule"
        ? "Tap based on COLOR."
        : variation === "Text Rule"
          ? "Tap based on TEXT."
          : "Rule switches mid-round.";
    case "sequence":
      return variation === "Reverse"
        ? "Repeat the sequence in reverse."
        : variation === "Odds Only"
          ? "Repeat only odd positions."
          : variation === "Evens Only"
            ? "Repeat only even positions."
            : "Repeat in the same order.";
    case "reaction":
      return "Tap only the target symbol before time runs out.";
    case "multi":
      return "Remember the safe set, tap only matching symbols.";
    default:
      return "";
  }
};

const makeRoundConfig = (
  type: RoundType,
  difficulty: DifficultySnapshot,
  seed: number,
  index: number,
): RoundConfig => {
  const rng = mulberry32(seed + index * 17);
  const meta = ROUND_META[type];
  const variation = variationByType(type, rng);
  const rule = ruleByType(type, variation);
  const timeBand =
    difficulty.level <= 3
      ? [6, 8]
      : difficulty.level <= 7
        ? [5, 6]
        : difficulty.level <= 12
          ? [4, 5]
          : [3, 4];
  const baseSeconds = timeBand[0] + rng() * (timeBand[1] - timeBand[0]);
  const adjustedSeconds = clamp(baseSeconds * (1.1 - difficulty.score * 0.03), timeBand[0], timeBand[1]);
  const timeLimitMs = Math.round(adjustedSeconds * 1000);
  const targetCount = Math.round(3 + difficulty.score * 0.7 + rng() * 2);

  return {
    id: `${type}-${seed}-${index}`,
    type,
    label: meta.label,
    difficulty,
    variation,
    seed: seed + index * 13,
    rule,
    targetCount,
    timeLimitMs,
    intro: pick(meta.intros, rng),
  };
};

export const createLevel = (
  levelIndex: number,
  adaptive: AdaptiveState,
  previousSequence: RoundType[] = [],
): LevelConfig => {
  const seed = createSeed();
  const rng = mulberry32(seed);
  const totalRounds = 4 + Math.floor(rng() * 3);

  const mustInclude: RoundType[] = ["pattern"];
  const types = shuffle(ROUND_POOL, rng);
  const picked: RoundType[] = [];

  mustInclude.forEach((type) => {
    if (!picked.includes(type)) picked.push(type);
  });

  while (picked.length < totalRounds) {
    const candidate = pick(types, rng);
    if (picked.length === 0 && candidate === "multi") continue;
    if (picked[picked.length - 1] === candidate) continue;
    picked.push(candidate);
  }

  // Ensure the sequence is not identical to the previous one.
  if (previousSequence.length === picked.length && previousSequence.every((t, i) => t === picked[i])) {
    const swapped = [...picked];
    const swapIndex = Math.max(1, Math.floor(rng() * (swapped.length - 1)));
    [swapped[swapIndex], swapped[swapIndex - 1]] = [swapped[swapIndex - 1], swapped[swapIndex]];
    picked.splice(0, picked.length, ...swapped);
  }

  // Make first easy and last hardest.
  if (picked[0] === "multi") {
    const replacement = picked.findIndex((type) => type !== "multi");
    if (replacement > 0) {
      [picked[0], picked[replacement]] = [picked[replacement], picked[0]];
    }
  }
  if (picked[picked.length - 1] !== "multi") {
    const hardestIndex = picked.findIndex((type) => type === "multi");
    if (hardestIndex > -1) {
      [picked[picked.length - 1], picked[hardestIndex]] = [picked[hardestIndex], picked[picked.length - 1]];
    }
  }

  const rounds = picked.map((type, index) => {
    const difficulty = makeDifficulty(levelIndex, adaptive, index, picked.length);
    return makeRoundConfig(type, difficulty, seed, index);
  });

  return { levelIndex, rounds, seed };
};

export const roundSequence = (level: LevelConfig) => level.rounds.map((round) => round.type);
