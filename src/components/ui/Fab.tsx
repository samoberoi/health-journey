import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "dark" | "white" | "red";
  size?: "md" | "sm";
  children: ReactNode;
}

/** Circular action button — always bottom-right of the hero card. */
export function Fab({ variant = "dark", size = "md", className, children, ...props }: FabProps) {
  const v = { dark: "", white: "fab-white", red: "fab-red" }[variant];
  return (
    <button type="button" className={cn("fab", v, size === "sm" && "fab-sm", className)} {...props}>
      {children}
    </button>
  );
}
