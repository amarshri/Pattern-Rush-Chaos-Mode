export type RoundType =
  | "pattern"
  | "color"
  | "sequence"
  | "reaction"
  | "multi";

export type DifficultySnapshot = {
  level: number;
  score: number;
  speedFactor: number;
  complexity: number;
};

export type RoundConfig = {
  id: string;
  type: RoundType;
  label: string;
  difficulty: DifficultySnapshot;
  variation: string;
  seed: number;
  rule: string;
  targetCount: number;
  timeLimitMs: number;
  intro: string;
};

export type RoundResult = {
  id: string;
  type: RoundType;
  score: number;
  accuracy: number;
  reactionMs: number;
  success: boolean;
  notes: string[];
};

export type LevelConfig = {
  levelIndex: number;
  rounds: RoundConfig[];
  seed: number;
};

export type PlayerStats = {
  level: number;
  highScore: number;
  brainScore: number;
  totalGames: number;
  avgAccuracy: number;
  avgReaction: number;
};

export type SessionStats = {
  score: number;
  accuracy: number;
  avgReaction: number;
  successCount: number;
  failCount: number;
};

export type AdaptiveState = {
  skill: number;
  streak: number;
  lastResults: RoundResult[];
};
