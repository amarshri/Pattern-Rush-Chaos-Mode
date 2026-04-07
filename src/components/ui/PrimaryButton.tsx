import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/ui";

export const PrimaryButton = ({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) => (
  <button
    className={cn(
      "rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] transition",
      "bg-white/10 text-white hover:bg-white/20 active:scale-[0.98]",
      "border border-white/15 shadow-[0_0_30px_rgba(255,255,255,0.08)]",
      className,
    )}
    {...props}
  />
);
