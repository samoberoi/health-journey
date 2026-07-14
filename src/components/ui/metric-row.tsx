import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export interface MetricRowProps {
  icon?: ReactNode;
  label: string;
  sublabel?: string;
  value?: string | number;
  unit?: string;
  right?: ReactNode;
  onClick?: () => void;
  showChevron?: boolean;
  tone?: "default" | "success" | "warning" | "critical";
  className?: string;
}

const toneBg: Record<NonNullable<MetricRowProps["tone"]>, string> = {
  default: "bg-[var(--bbdo-blue-soft)] text-[var(--bbdo-blue)]",
  success: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]",
  warning: "bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]",
  critical: "bg-[hsl(var(--critical-soft))] text-[hsl(var(--critical))]",
};

export function MetricRow({
  icon,
  label,
  sublabel,
  value,
  unit,
  right,
  onClick,
  showChevron,
  tone = "default",
  className,
}: MetricRowProps) {
  const Comp: any = onClick ? motion.button : "div";
  return (
    <Comp
      onClick={onClick}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "bbdo-card w-full flex items-center gap-3 p-4 text-left",
        onClick && "bbdo-hover-lift",
        className,
      )}
    >
      {icon && (
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", toneBg[tone])}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-foreground truncate">{label}</div>
        {sublabel && <div className="text-xs text-muted-foreground truncate mt-0.5">{sublabel}</div>}
      </div>
      {(value !== undefined || right) && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {value !== undefined && (
            <span className="stat-number text-lg text-foreground">
              {value}
              {unit && <span className="ml-0.5 text-xs font-medium text-muted-foreground">{unit}</span>}
            </span>
          )}
          {right}
        </div>
      )}
      {showChevron && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
    </Comp>
  );
}

export default MetricRow;
