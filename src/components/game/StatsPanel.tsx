import type { PlayerProfile } from "@/lib/profile";
import { formatMs } from "@/lib/utils";

export const StatsPanel = ({ profile }: { profile: PlayerProfile }) => (
  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
    <h3 className="text-lg font-semibold uppercase tracking-[0.25em] text-white/80">
      Player Stats
    </h3>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Highest Score</p>
        <p className="mt-2 text-2xl font-semibold text-white">{profile.highScore}</p>
      </div>
      <div className="rounded-2xl bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Brain Score</p>
        <p className="mt-2 text-2xl font-semibold text-white">{profile.brainScore}</p>
      </div>
      <div className="rounded-2xl bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Average Accuracy</p>
        <p className="mt-2 text-2xl font-semibold text-white">
          {(profile.avgAccuracy * 100).toFixed(1)}%
        </p>
      </div>
      <div className="rounded-2xl bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Average Reaction</p>
        <p className="mt-2 text-2xl font-semibold text-white">
          {formatMs(profile.avgReaction)}
        </p>
      </div>
    </div>
  </div>
);
