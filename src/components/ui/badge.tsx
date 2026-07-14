import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border-[var(--bbdo-line)]",
        info: "border-transparent bg-[var(--bbdo-blue-soft)] text-[var(--bbdo-blue)]",
        success: "border-transparent bg-[hsl(var(--success-soft))] text-[var(--bbdo-mint)]",
        alert: "border-transparent bg-[var(--bbdo-red-soft)] text-[var(--bbdo-red)]",
        caution: "border-transparent bg-[hsl(var(--warning-soft))] text-[var(--bbdo-amber)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
