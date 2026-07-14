import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { motion } from "framer-motion";

type Trend = "up" | "down" | "flat";

export interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  trend?: Trend;
  trendValue?: string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "critical" | "info";
  className?: string;
  onClick?: () => void;
}

const toneRing: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "",
  success: "ring-1 ring-[hsl(var(--success)/0.25)]",
  warning: "ring-1 ring-[hsl(var(--warning)/0.30)]",
  critical: "ring-1 ring-[hsl(var(--critical)/0.30)]",
  info: "ring-1 ring-[hsl(var(--info)/0.20)]",
};

export function StatCard({
  label,
  value,
  unit,
  hint,
  trend,
  trendValue,
  icon,
  tone = "default",
  className,
  onClick,
}: StatCardProps) {
  const TrendArrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendColor =
    trend === "up"
      ? "text-[hsl(var(--success))]"
      : trend === "down"
      ? "text-[hsl(var(--critical))]"
      : "text-muted-foreground";

  return (
    <motion.div
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={cn(
        "bbdo-card p-5 flex flex-col gap-2",
        onClick && "cursor-pointer bbdo-hover-lift",
        toneRing[tone],
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="bbdo-eyebrow text-muted-foreground">{label}</span>
        {icon && <div className="text-[var(--bbdo-blue)]">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="stat-number text-[36px] leading-none text-foreground">{value}</span>
        {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
      </div>
      {(hint || trendValue) && (
        <div className="flex items-center gap-2 text-xs">
          {trend && trendValue && (
            <span className={cn("font-semibold tabular", trendColor)}>
              {TrendArrow} {trendValue}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </motion.div>
  );
}

export default StatCard;
