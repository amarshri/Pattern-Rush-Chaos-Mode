"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createAdaptiveState, updateAdaptiveState } from "@/lib/game/adaptive";
import { createLevel, roundSequence } from "@/lib/game/engine";
import type {
  AdaptiveState,
  LevelConfig,
  RoundConfig,
  RoundResult,
  RoundType,
} from "@/lib/game/types";
import {
  aggregateRoundStats,
  applySessionStats,
  loadProfile,
  saveProfile,
  storeSequence,
  syncProfile,
} from "@/lib/profile";
import { hapticPulse, playTone } from "@/lib/feedback";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { RoundShell } from "@/components/game/RoundShell";
import { PatternRound } from "@/components/game/rounds/PatternRound";
import { ColorRound } from "@/components/game/rounds/ColorRound";
import { SequenceRound } from "@/components/game/rounds/SequenceRound";
import { ReactionRound } from "@/components/game/rounds/ReactionRound";
import { MultiRound } from "@/components/game/rounds/MultiRound";
import { isSupabaseEnabled, supabase } from "@/lib/supabase/client";

const RoundRenderer = ({
  round,
  onComplete,
}: {
  round: RoundConfig;
  onComplete: (result: RoundResult) => void;
}) => {
  switch (round.type) {
    case "pattern":
      return <PatternRound round={round} onComplete={onComplete} />;
    case "color":
      return <ColorRound round={round} onComplete={onComplete} />;
    case "sequence":
      return <SequenceRound round={round} onComplete={onComplete} />;
    case "reaction":
      return <ReactionRound round={round} onComplete={onComplete} />;
    case "multi":
      return <MultiRound round={round} onComplete={onComplete} />;
    default:
      return null;
  }
};

export const GameApp = () => {
  const [profile, setProfile] = useState(() => loadProfile());
  const [hydrated, setHydrated] = useState(false);
  const [adaptive, setAdaptive] = useState<AdaptiveState>(createAdaptiveState());
  const [level, setLevel] = useState<LevelConfig | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [screen, setScreen] = useState<"home" | "playing" | "results" | "stats" | "settings">("home");
  const [phase, setPhase] = useState<"intro" | "playing" | "result" | "failed">("intro");
  const [introCount, setIntroCount] = useState(5);
  const [playTimeLeft, setPlayTimeLeft] = useState<number | null>(null);
  const [flash, setFlash] = useState<"success" | "fail" | null>(null);
  const [lastSessionStats, setLastSessionStats] = useState<ReturnType<typeof aggregateRoundStats> | null>(null);
  const [leaders, setLeaders] = useState<Array<{ name: string; high_score: number }>>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
    supabase
      .from("leaderboard")
      .select("name, high_score")
      .order("high_score", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setLeaders(data);
      });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(loadProfile());
    setHydrated(true);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const currentRound = level?.rounds[roundIndex];

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const startPlayTimer = (durationMs: number) => {
    clearTimer();
    setPlayTimeLeft(durationMs);
    const end = performance.now() + durationMs;
    timerRef.current = setInterval(() => {
      const remaining = end - performance.now();
      if (remaining <= 0) {
        clearTimer();
        setPlayTimeLeft(0);
        return;
      }
      setPlayTimeLeft(remaining);
    }, 120);
  };

  const startIntro = (playMs: number) => {
    clearTimer();
    setPhase("intro");
    setIntroCount(5);
    setPlayTimeLeft(null);
    timerRef.current = setInterval(() => {
      setIntroCount((prev) => {
        if (prev <= 1) {
          clearTimer();
          setPhase("playing");
          startPlayTimer(playMs);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startGame = () => {
    const cleanName = profile.name.trim() || "Player";
    if (cleanName !== profile.name) {
      const updated = { ...profile, name: cleanName };
      setProfile(updated);
      saveProfile(updated);
    }
    const nextLevel = createLevel(
      profile.level,
      adaptive,
      profile.lastSequence as unknown as RoundType[],
    );
    setLevel(nextLevel);
    setRoundIndex(0);
    setResults([]);
    setScreen("playing");
    setProfile((prev) => storeSequence(prev, roundSequence(nextLevel)));
    startIntro(nextLevel.rounds[0].timeLimitMs);
  };

  const finishLevel = async (roundResults: RoundResult[]) => {
    const sessionStats = aggregateRoundStats(roundResults);
    const updatedProfile = {
      ...applySessionStats(profile, sessionStats),
      level: profile.level + 1,
    };
    setProfile(updatedProfile);
    await syncProfile(updatedProfile);
    setLastSessionStats(sessionStats);
    setPhase("result");
    clearTimer();
    setPlayTimeLeft(null);
    timerRef.current = setInterval(() => {
      clearTimer();
      const nextLevel = createLevel(
        updatedProfile.level,
        adaptive,
        updatedProfile.lastSequence as unknown as RoundType[],
      );
      setLevel(nextLevel);
      setRoundIndex(0);
      setResults([]);
      setProfile((prev) => storeSequence(prev, roundSequence(nextLevel)));
      startIntro(nextLevel.rounds[0].timeLimitMs);
    }, 2400);
  };

  const handleRoundComplete = (result: RoundResult) => {
    const nextResults = [...results, result];
    setResults(nextResults);
    setAdaptive((prev) => updateAdaptiveState(prev, result));
    setFlash(result.success ? "success" : "fail");
    setTimeout(() => setFlash(null), 200);
    clearTimer();
    setPlayTimeLeft(null);

    if (profile.settings.sound) {
      playTone(result.success ? 540 : 220, 0.14, 0.2);
    }
    if (profile.settings.haptics) {
      hapticPulse(result.success ? 30 : [20, 40, 20]);
    }

    if (!result.success) {
      const sessionStats = aggregateRoundStats(nextResults);
      setLastSessionStats(sessionStats);
      setPhase("failed");
      const resetProfile = { ...profile, level: 1, lastSequence: [] };
      setProfile(resetProfile);
      syncProfile(resetProfile);
      clearTimer();
      timerRef.current = setInterval(() => {
        clearTimer();
        setScreen("home");
        setLevel(null);
        setResults([]);
        setRoundIndex(0);
      }, 2600);
      return;
    }

    if (level && roundIndex + 1 >= level.rounds.length) {
      finishLevel(nextResults);
    } else {
      if (!level) return;
      const nextIndex = roundIndex + 1;
      setRoundIndex(nextIndex);
      startIntro(level.rounds[nextIndex].timeLimitMs);
    }
  };


  const mainClass =
    screen === "playing"
      ? "relative mx-auto flex h-screen w-full max-w-6xl flex-col px-3 py-3 sm:px-4"
      : "relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 pb-16 pt-10 sm:px-8";

  const displayTimer =
    phase === "intro"
      ? introCount
      : playTimeLeft !== null
        ? Math.max(0, Math.ceil(playTimeLeft / 1000))
        : null;

  useEffect(() => {
    if (!profile.settings.haptics) return;
    if (phase !== "playing") return;
    if (displayTimer === null) return;
    if (displayTimer <= 3 && displayTimer > 0) {
      hapticPulse(20);
    }
  }, [displayTimer, phase, profile.settings.haptics]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1d1f33_0%,_#0b0d16_45%,_#07080d_100%)] text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 top-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-[120px]" />
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-[120px]" />
        </div>
        <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-sm uppercase tracking-[0.35em] text-white/60">
            Loading...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1d1f33_0%,_#0b0d16_45%,_#07080d_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-[120px]" />
      </div>
      <main className={mainClass}>
        {screen !== "playing" && (
          <header className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-white/50">Pattern Rush</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Chaos Mode</h1>
            </div>
          </header>
        )}

        {screen === "home" && (
          <section className="mx-auto w-full max-w-lg">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-2xl">
              <h2 className="text-2xl font-semibold">Start Run</h2>
              <p className="mt-2 text-sm text-white/60">Enter your name and chase the top score.</p>

              <div className="mt-5">
                <label className="text-xs uppercase tracking-[0.35em] text-white/50">Player Name</label>
                <input
                  value={profile.name}
                  onChange={(event) => {
                    const updated = { ...profile, name: event.target.value.slice(0, 18) };
                    setProfile(updated);
                    saveProfile(updated);
                  }}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                  placeholder="Player"
                />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">High Score</p>
                <div className="mt-2 text-3xl font-semibold">{profile.highScore}</div>
              </div>

              <div className="mt-6">
                <PrimaryButton onClick={startGame} className="w-full">
                  Start Game
                </PrimaryButton>
              </div>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Leaderboard</p>
                {isSupabaseEnabled ? (
                  <div className="mt-3 space-y-2 text-sm">
                    {leaders.length === 0 && <p className="text-white/40">No scores yet.</p>}
                    {leaders.map((entry, idx) => (
                      <div key={entry.name} className="flex items-center justify-between text-white/80">
                        <span className="text-white/50">{idx + 1}</span>
                        <span className="flex-1 px-3 truncate">{entry.name}</span>
                        <span>{entry.high_score}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-white/40">
                    Supabase offline. Add NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY to enable.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {screen === "playing" && level && currentRound && (
          <section className="flex h-screen min-h-0 flex-col overflow-y-auto lg:flex-row lg:gap-4 lg:overflow-hidden">
            <aside className="flex shrink-0 flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 lg:h-full lg:w-[32%] lg:max-h-full lg:sticky lg:top-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/50">
                <span>Level {level.levelIndex}</span>
                {(phase === "intro" || phase === "playing") && <span>Timer {displayTimer ?? "--"}s</span>}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Question</p>
                <h2 className="mt-4 text-2xl font-semibold">{currentRound.rule}</h2>
              </div>
            </aside>

            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 lg:w-[68%] lg:p-4">
              {flash && (
                <div
                  className={
                    "pointer-events-none absolute inset-0 z-10 " +
                    (flash === "success" ? "bg-emerald-400/20" : "bg-rose-500/20")
                  }
                />
              )}

              {phase === "intro" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 text-center lg:hidden"
                >
                  <p className="text-xs uppercase tracking-[0.35em] text-white/50">{currentRound.label}</p>
                  <h2 className="mt-4 text-2xl font-semibold">{currentRound.intro}</h2>
                  <p className="mt-2 text-white/60">{currentRound.rule}</p>
                  <div className="mt-6 text-5xl font-semibold text-white/80">{introCount}</div>
                </motion.div>
              )}

              {phase === "intro" && (
                <div className="hidden h-full w-full items-center justify-center lg:flex">
                  <div className="w-full max-w-[min(70vh,55vw)] rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-[0.35em] text-white/40">Get Ready</p>
                    <h3 className="mt-4 text-xl font-semibold text-white/80">Starting in {introCount}s</h3>
                    <p className="mt-2 text-sm text-white/40">Game area locked</p>
                  </div>
                </div>
              )}

              {phase === "playing" && (
                <RoundShell key={currentRound.id}>
                  <RoundRenderer round={currentRound} onComplete={handleRoundComplete} />
                </RoundShell>
              )}

              {phase === "result" && lastSessionStats && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 text-center"
                >
                  <p className="text-xs uppercase tracking-[0.35em] text-white/50">Level Complete</p>
                  <h2 className="mt-4 text-2xl font-semibold">Level {profile.level - 1} cleared</h2>
                  <p className="mt-2 text-white/60">
                    Accuracy {(lastSessionStats.accuracy * 100).toFixed(1)}% · Avg reaction{" "}
                    {(lastSessionStats.avgReaction / 1000).toFixed(2)}s
                  </p>
                  <div className="mt-6 text-lg uppercase tracking-[0.3em] text-white/70">
                    Level {profile.level} starting...
                  </div>
                </motion.div>
              )}

              {phase === "failed" && lastSessionStats && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-xl rounded-3xl border border-rose-400/30 bg-rose-500/10 p-6 text-center"
                >
                  <p className="text-xs uppercase tracking-[0.35em] text-rose-200">Game Over - You Failed</p>
                  <h2 className="mt-4 text-2xl font-semibold">Level {level.levelIndex} stopped</h2>
                  <p className="mt-2 text-white/70">
                    Accuracy {(lastSessionStats.accuracy * 100).toFixed(1)}% · Avg reaction{" "}
                    {(lastSessionStats.avgReaction / 1000).toFixed(2)}s
                  </p>
                  <p className="mt-4 text-sm text-white/60">
                    Rounds cleared {lastSessionStats.successCount}/{lastSessionStats.successCount + lastSessionStats.failCount}
                  </p>
                </motion.div>
              )}
            </div>
          </section>
        )}

      </main>
    </div>
  );
};
