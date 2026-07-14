import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HeroCardProps {
  variant?: "navy" | "blue" | "red" | "mint" | "cream" | "white";
  className?: string;
  children: ReactNode;
}

/**
 * The governing surface for every screen — dark saturated card with white text,
 * big numerals, corner stat pills, and a bottom-right FAB slot.
 * Ref: uploaded design (Image 2 hero cards).
 */
export function HeroCard({ variant = "navy", className, children }: HeroCardProps) {
  const map = {
    navy: "hero-card",
    blue: "hero-card hero-card-blue",
    red: "hero-card hero-card-red",
    mint: "hero-card hero-card-mint",
    cream: "hero-card hero-card-cream",
    white: "hero-card hero-card-white",
  } as const;
  return <div className={cn(map[variant], className)}>{children}</div>;
}
