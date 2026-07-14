import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: "md" | "sm";
  children: ReactNode;
}

/** Filter chip — dark-filled when active, white-outlined when idle. */
export function Chip({ active, size = "md", className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn("chip ios-tap", active && "chip-active", size === "sm" && "chip-sm", className)}
      {...props}
    >
      {children}
    </button>
  );
}
