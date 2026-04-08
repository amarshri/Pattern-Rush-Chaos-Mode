"use client";

import { motion } from "framer-motion";
export const RoundShell = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.4 }}
    className="w-full max-w-[90vw] lg:max-w-[min(70vh,55vw)] lg:max-h-full"
  >
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl lg:p-5">
      {children}
    </div>
  </motion.div>
);
