import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export interface CircularGaugeProps {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  center?: ReactNode;
  className?: string;
}

export function CircularGauge({
  value,
  max = 100,
  size = 140,
  stroke = 12,
  color = "var(--bbdo-blue)",
  trackColor = "var(--bbdo-blue-soft)",
  label,
  sublabel,
  center,
  className,
}: CircularGaugeProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        {center ?? (
          <>
            {label && <div className="stat-number text-2xl text-foreground leading-none">{label}</div>}
            {sublabel && <div className="text-[11px] text-muted-foreground mt-1 font-medium">{sublabel}</div>}
          </>
        )}
      </div>
    </div>
  );
}

export default CircularGauge;
