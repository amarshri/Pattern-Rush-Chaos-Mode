"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
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
import { ResultPanel } from "@/components/game/ResultPanel";
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
  const [adaptive, setAdaptive] = useState<AdaptiveState>(createAdaptiveState());
  const [level, setLevel] = useState<LevelConfig | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [screen, setScreen] = useState<"home" | "playing" | "results" | "stats" | "settings">("home");
  const [introCount, setIntroCount] = useState(3);
  const [showIntro, setShowIntro] = useState(true);
  const [leaders, setLeaders] = useState<Array<{ user_id: string; high_score: number; brain_score: number }>>([]);

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

  const currentRound = level?.rounds[roundIndex];

  const triggerIntro = () => {
    setIntroCount(3);
    setShowIntro(true);
  };

  useEffect(() => {
    if (!showIntro) return;
    const timer = setInterval(() => {
      setIntroCount((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowIntro(false);
          return 0;
        }
        return prev - 1;
      });
    }, 650);
    return () => clearInterval(timer);
  }, [showIntro]);

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
    triggerIntro();
  };

  const finishLevel = async (roundResults: RoundResult[]) => {
    const sessionStats = aggregateRoundStats(roundResults);
    const updatedProfile = {
      ...applySessionStats(profile, sessionStats),
      level: profile.level + 1,
    };
    setProfile(updatedProfile);
    await syncProfile(updatedProfile, sessionStats);
    setScreen("results");
  };

  const handleRoundComplete = (result: RoundResult) => {
    const nextResults = [...results, result];
    setResults(nextResults);
    setAdaptive((prev) => updateAdaptiveState(prev, result));

    if (profile.settings.sound) {
      playTone(result.success ? 540 : 220, 0.14, 0.2);
    }
    if (profile.settings.haptics) {
      hapticPulse(result.success ? 30 : [20, 40, 20]);
    }

    if (level && roundIndex + 1 >= level.rounds.length) {
      finishLevel(nextResults);
    } else {
      setRoundIndex((prev) => prev + 1);
      triggerIntro();
    }
  };

  const sessionStats = useMemo(() => (results.length ? aggregateRoundStats(results) : null), [results]);

  const adaptiveHint = useMemo(() => {
    const score = adaptive.skill;
    if (score > 0.45) return "Dialing up the chaos.";
    if (score < -0.35) return "Easing pressure for a cleaner run.";
    return "Holding steady difficulty.";
  }, [adaptive.skill]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1d1f33_0%,_#0b0d16_45%,_#07080d_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-[120px]" />
      </div>
      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 pb-16 pt-10 sm:px-8">
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
          <section className="grid gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs uppercase tracking-[0.3em] text-white/50">
              <span>Level {level.levelIndex}</span>
              <span>Difficulty {currentRound.difficulty.score.toFixed(1)}</span>
              <span>{adaptiveHint}</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-400 transition-all"
                style={{ width: `${((roundIndex + 1) / level.rounds.length) * 100}%` }}
              />
            </div>

            {showIntro ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center"
              >
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">{currentRound.label}</p>
                <h2 className="mt-4 text-2xl font-semibold">{currentRound.intro}</h2>
                <p className="mt-2 text-white/60">{currentRound.rule}</p>
                <div className="mt-6 text-5xl font-semibold text-white/80">{introCount}</div>
              </motion.div>
            ) : (
              <RoundShell round={currentRound} roundIndex={roundIndex} totalRounds={level.rounds.length}>
                <RoundRenderer round={currentRound} onComplete={handleRoundComplete} />
              </RoundShell>
            )}
          </section>
        )}

        {screen === "results" && sessionStats && (
          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <ResultPanel stats={sessionStats} level={profile.level - 1} />
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold uppercase tracking-[0.25em] text-white/70">Next Move</h3>
              <p className="mt-4 text-white/60">
                You cleared {sessionStats.successCount} rounds with {(sessionStats.accuracy * 100).toFixed(1)}%
                accuracy. Ready for the next level?
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <PrimaryButton onClick={startGame}>Next Level</PrimaryButton>
                <button
                  onClick={() => setScreen("home")}
                  className="rounded-full border border-white/15 px-5 py-3 text-xs uppercase tracking-[0.2em] text-white/70 hover:bg-white/10"
                >
                  Home
                </button>
              </div>
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
