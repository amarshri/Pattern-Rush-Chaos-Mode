"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
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
  storeSequence,
  syncProfile,
  updateSettings,
} from "@/lib/profile";
import { hapticPulse, playTone } from "@/lib/feedback";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { RoundShell } from "@/components/game/RoundShell";
import { PatternRound } from "@/components/game/rounds/PatternRound";
import { ColorRound } from "@/components/game/rounds/ColorRound";
import { SequenceRound } from "@/components/game/rounds/SequenceRound";
import { ReactionRound } from "@/components/game/rounds/ReactionRound";
import { MultiRound } from "@/components/game/rounds/MultiRound";
import { StatsPanel } from "@/components/game/StatsPanel";
import { SettingsPanel } from "@/components/game/SettingsPanel";
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
  const [flash, setFlash] = useState<"success" | "fail" | null>(null);
  const [lastSessionStats, setLastSessionStats] = useState<ReturnType<typeof aggregateRoundStats> | null>(null);
  const [leaders, setLeaders] = useState<Array<{ user_id: string; high_score: number; brain_score: number }>>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
    supabase
      .from("profiles")
      .select("user_id, high_score, brain_score")
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
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const currentRound = level?.rounds[roundIndex];

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const startIntro = () => {
    clearTimer();
    setPhase("intro");
    setIntroCount(5);
    timerRef.current = setInterval(() => {
      setIntroCount((prev) => {
        if (prev <= 1) {
          clearTimer();
          setPhase("playing");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startGame = () => {
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
    startIntro();
  };

  const finishLevel = async (roundResults: RoundResult[]) => {
    const sessionStats = aggregateRoundStats(roundResults);
    const updatedProfile = {
      ...applySessionStats(profile, sessionStats),
      level: profile.level + 1,
    };
    setProfile(updatedProfile);
    await syncProfile(updatedProfile, sessionStats);
    setLastSessionStats(sessionStats);
    setPhase("result");
    clearTimer();
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
      startIntro();
    }, 2400);
  };

  const handleRoundComplete = (result: RoundResult) => {
    const nextResults = [...results, result];
    setResults(nextResults);
    setAdaptive((prev) => updateAdaptiveState(prev, result));
    setFlash(result.success ? "success" : "fail");
    setTimeout(() => setFlash(null), 200);

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
      syncProfile(resetProfile, sessionStats);
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
      const nextIndex = roundIndex + 1;
      setRoundIndex(nextIndex);
      startIntro();
    }
  };

  const sessionStats = useMemo(() => (results.length ? aggregateRoundStats(results) : null), [results]);
  const gameState = useMemo(
    () => ({
      level: level?.levelIndex ?? profile.level,
      roundIndex,
      phase,
      timer: introCount,
      accuracy: sessionStats?.accuracy ?? 0,
    }),
    [introCount, level?.levelIndex, phase, profile.level, roundIndex, sessionStats?.accuracy],
  );

  const adaptiveHint = useMemo(() => {
    const score = adaptive.skill;
    if (score > 0.45) return "Dialing up the chaos.";
    if (score < -0.35) return "Easing pressure for a cleaner run.";
    return "Holding steady difficulty.";
  }, [adaptive.skill]);

  const mainClass =
    screen === "playing"
      ? "relative mx-auto flex h-screen w-full max-w-6xl flex-col px-3 py-3 sm:px-4"
      : "relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 pb-16 pt-10 sm:px-8";

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
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setScreen("stats")}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:bg-white/10"
              >
                Stats
              </button>
              <button
                onClick={() => setScreen("settings")}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:bg-white/10"
              >
                Settings
              </button>
            </div>
          </header>
        )}

        {screen === "home" && (
          <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl">
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">Adaptive Cognitive Runner</p>
              <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">
                Procedural rounds. No repeats. Just your brain vs the clock.
              </h2>
              <p className="mt-4 text-white/60">
                Levels chain together 4-6 rounds, ending in a high-pressure finale. Your performance tweaks the
                difficulty, ensuring every run feels fair and fresh.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <PrimaryButton onClick={startGame}>Start Game</PrimaryButton>
                <button
                  onClick={() => setScreen("stats")}
                  className="rounded-full border border-white/15 px-5 py-3 text-xs uppercase tracking-[0.2em] text-white/70 hover:bg-white/10"
                >
                  View Stats
                </button>
              </div>
              <div className="mt-8 flex flex-wrap gap-3 text-xs uppercase tracking-[0.3em] text-white/40">
                <span>Level {profile.level}</span>
                <span>High Score {profile.highScore}</span>
                <span>Brain Score {profile.brainScore}</span>
              </div>
            </div>
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold uppercase tracking-[0.25em] text-white/70">Round Deck</h3>
              <ul className="mt-4 space-y-3 text-sm text-white/60">
                <li>Pattern Recall</li>
                <li>Color Confusion</li>
                <li>Sequence Memory</li>
                <li>Reaction Trap</li>
                <li>Multi-Task Surge</li>
              </ul>
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs uppercase tracking-[0.3em] text-white/50">
                {adaptiveHint}
              </div>
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
                <p className="uppercase tracking-[0.3em] text-white/50">Leaderboard</p>
                {isSupabaseEnabled ? (
                  <div className="mt-3 space-y-2 text-sm">
                    {leaders.length === 0 && <p className="text-white/40">No scores yet.</p>}
                    {leaders.map((entry, idx) => (
                      <div key={entry.user_id} className="flex items-center justify-between">
                        <span className="text-white/50">#{idx + 1}</span>
                        <span className="text-white/80">{entry.high_score}</span>
                        <span className="text-white/40">{entry.brain_score} BS</span>
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
              <div className="text-xs uppercase tracking-[0.45em] text-white/50">Pattern Rush</div>
              <h1 className="text-2xl font-semibold tracking-tight">Chaos Mode</h1>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.3em] text-white/50">
                <span>Level {level.levelIndex}</span>
                <span>
                  Round {roundIndex + 1}/{level.rounds.length}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-400 transition-all"
                  style={{ width: `${((roundIndex + 1) / level.rounds.length) * 100}%` }}
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">{currentRound.label}</p>
                <h2 className="mt-3 text-2xl font-semibold">{currentRound.intro}</h2>
                <p className="mt-2 text-white/60">{currentRound.rule}</p>
              </div>
              {phase === "intro" && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/50">Starting In</p>
                  <div className="mt-2 text-4xl font-semibold text-white/90">{introCount}</div>
                </div>
              )}
              <div className="text-xs uppercase tracking-[0.3em] text-white/40">{adaptiveHint}</div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-white/30">
                Accuracy {(gameState.accuracy * 100).toFixed(1)}%
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
                <RoundShell round={currentRound} roundIndex={roundIndex} totalRounds={level.rounds.length}>
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

        {screen === "stats" && (
          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <StatsPanel profile={profile} />
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/60">
              <h3 className="text-lg font-semibold uppercase tracking-[0.25em] text-white/70">Session Pulse</h3>
              <p className="mt-4">
                {sessionStats
                  ? `Last run score ${sessionStats.score}, accuracy ${(sessionStats.accuracy * 100).toFixed(1)}%.`
                  : "Play a level to generate a session pulse."}
              </p>
              <div className="mt-6">
                <PrimaryButton onClick={() => setScreen("home")} className="text-xs">
                  Back Home
                </PrimaryButton>
              </div>
            </div>
          </section>
        )}

        {screen === "settings" && (
          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <SettingsPanel
              settings={profile.settings}
              onChange={(next) => setProfile((prev) => updateSettings(prev, next))}
            />
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/60">
              <h3 className="text-lg font-semibold uppercase tracking-[0.25em] text-white/70">Accessibility</h3>
              <p className="mt-4">
                Haptics and sound make feedback clearer on mobile. Toggle them anytime. Settings save locally.
              </p>
              <div className="mt-6">
                <PrimaryButton onClick={() => setScreen("home")} className="text-xs">
                  Back Home
                </PrimaryButton>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
