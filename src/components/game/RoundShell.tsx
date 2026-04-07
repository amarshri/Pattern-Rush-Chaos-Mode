"use client";

import { motion } from "framer-motion";
import type { RoundConfig } from "@/lib/game/types";

export const RoundShell = ({
  round,
  roundIndex,
  totalRounds,
  children,
}: {
  round: RoundConfig;
  roundIndex: number;
  totalRounds: number;
  children: React.ReactNode;
}) => (
  <motion.div
    key={round.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.4 }}
    className="w-full"
  >
    <div className="flex flex-wrap items-center justify-between gap-4 text-white/70">
      <div className="text-xs uppercase tracking-[0.35em]">
        Round {roundIndex + 1} / {totalRounds}
      </div>
      <div className="text-xs uppercase tracking-[0.35em]">{round.label}</div>
      <div className="text-xs uppercase tracking-[0.35em]">{round.variation}</div>
    </div>
    <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
      <div className="text-sm uppercase tracking-[0.3em] text-white/60">Rule</div>
      <p className="mt-2 text-lg font-semibold text-white">{round.rule}</p>
      <div className="mt-6">{children}</div>
    </div>
  </motion.div>
);
