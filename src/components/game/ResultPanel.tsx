import type { SessionStats } from "@/lib/game/types";
import { formatMs } from "@/lib/utils";

export const ResultPanel = ({
  stats,
  level,
}: {
  stats: SessionStats;
  level: number;
}) => (
  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-2xl">
    <h2 className="text-xl font-semibold uppercase tracking-[0.25em] text-white/70">
      Level {level} Results
    </h2>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl bg-white/10 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Score</p>
        <p className="mt-2 text-3xl font-semibold">{stats.score}</p>
      </div>
      <div className="rounded-2xl bg-white/10 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Accuracy</p>
        <p className="mt-2 text-3xl font-semibold">
          {(stats.accuracy * 100).toFixed(1)}%
        </p>
      </div>
      <div className="rounded-2xl bg-white/10 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Avg Reaction</p>
        <p className="mt-2 text-3xl font-semibold">{formatMs(stats.avgReaction)}</p>
      </div>
      <div className="rounded-2xl bg-white/10 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Rounds Cleared</p>
        <p className="mt-2 text-3xl font-semibold">
          {stats.successCount}/{stats.successCount + stats.failCount}
        </p>
      </div>
    </div>
  </div>
);
