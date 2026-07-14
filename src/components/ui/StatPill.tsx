import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatPillProps {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}

/** Small rounded chip that sits at the corners of a HeroCard. */
export function StatPill({ label, value, className }: StatPillProps) {
  return (
    <div className={cn("stat-pill", className)}>
      <span className="stat-pill-label">{label}</span>
      <span className="stat-pill-value">{value}</span>
    </div>
  );
}
