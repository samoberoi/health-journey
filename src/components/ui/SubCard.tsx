import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SubCardProps {
  variant?: "white" | "mint" | "lime" | "cream";
  tight?: boolean;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}

/** White (or accent) card that sits below a HeroCard. */
export function SubCard({ variant = "white", tight, className, onClick, children }: SubCardProps) {
  const bg = {
    white: "",
    mint: "sub-card-mint",
    lime: "sub-card-lime",
    cream: "sub-card-cream",
  }[variant];
  return (
    <div
      className={cn("sub-card", bg, tight && "sub-card-tight", onClick && "ios-tap cursor-pointer", className)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
