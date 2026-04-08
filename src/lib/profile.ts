import type { PlayerStats, RoundResult, SessionStats } from "@/lib/game/types";
import { supabase, isSupabaseEnabled } from "@/lib/supabase/client";
import { clamp } from "@/lib/utils";

export type PlayerSettings = {
  sound: boolean;
  haptics: boolean;
};

export type PlayerProfile = PlayerStats & {
  name: string;
  settings: PlayerSettings;
  lastSequence: string[];
  updatedAt: string;
};

const STORAGE_KEY = "pattern_rush_profile_v1";

const defaultProfile: PlayerProfile = {
  level: 1,
  highScore: 0,
  brainScore: 0,
  totalGames: 0,
  avgAccuracy: 0,
  avgReaction: 0,
  name: "Player",
  settings: {
    sound: true,
    haptics: true,
  },
  lastSequence: [],
  updatedAt: new Date().toISOString(),
};

export const loadProfile = (): PlayerProfile => {
  if (typeof window === "undefined") return defaultProfile;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultProfile;
  try {
    const parsed = JSON.parse(raw) as PlayerProfile;
    return { ...defaultProfile, ...parsed };
  } catch {
    return defaultProfile;
  }
};

export const saveProfile = (profile: PlayerProfile) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...profile, updatedAt: new Date().toISOString() }),
  );
};

export const updateSettings = (profile: PlayerProfile, settings: Partial<PlayerSettings>) => {
  const updated = {
    ...profile,
    settings: {
      ...profile.settings,
      ...settings,
    },
  };
  saveProfile(updated);
  return updated;
};

export const applySessionStats = (
  profile: PlayerProfile,
  session: SessionStats,
): PlayerProfile => {
  const totalGames = profile.totalGames + 1;
  const avgAccuracy =
    (profile.avgAccuracy * profile.totalGames + session.accuracy) / totalGames;
  const avgReaction =
    (profile.avgReaction * profile.totalGames + session.avgReaction) / totalGames;
  const highScore = Math.max(profile.highScore, session.score);
  const brainScore = Math.round(
    clamp((avgAccuracy * 100) / Math.max(1, avgReaction / 1000), 40, 160),
  );

  const updated = {
    ...profile,
    totalGames,
    avgAccuracy,
    avgReaction,
    highScore,
    brainScore,
  };

  saveProfile(updated);
  return updated;
};

export const storeSequence = (profile: PlayerProfile, sequence: string[]) => {
  const updated = { ...profile, lastSequence: sequence };
  saveProfile(updated);
  return updated;
};

export const syncProfile = async (profile: PlayerProfile) => {
  if (!isSupabaseEnabled || !supabase) return;
  try {
    const { data: existing } = await supabase
      .from("leaderboard")
      .select("high_score")
      .eq("name", profile.name)
      .maybeSingle();

    const currentHigh = existing?.high_score ?? 0;
    if (profile.highScore <= currentHigh) return;

    await supabase.from("leaderboard").upsert(
      {
        name: profile.name,
        high_score: profile.highScore,
      },
      { onConflict: "name" },
    );
  } catch (error) {
    console.error("Supabase sync failed", error);
  }
};

export const aggregateRoundStats = (results: RoundResult[]): SessionStats => {
  const totalScore = results.reduce((acc, cur) => acc + cur.score, 0);
  const accuracy = results.reduce((acc, cur) => acc + cur.accuracy, 0) / results.length;
  const avgReaction = results.reduce((acc, cur) => acc + cur.reactionMs, 0) / results.length;
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  return {
    score: Math.round(totalScore),
    accuracy,
    avgReaction,
    successCount,
    failCount,
  };
};
