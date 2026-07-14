import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "blue" | "red" | "mint" | "amber" | "ink" | "violet";

interface Props {
  label: string;
  value: React.ReactNode;
  delta?: string;
  trend?: "up" | "down" | "flat";
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}

const toneMap: Record<Tone, { soft: string; text: string }> = {
  blue:   { soft: "bg-info-soft",     text: "text-info" },
  red:    { soft: "bg-critical-soft", text: "text-critical" },
  mint:   { soft: "bg-success-soft",  text: "text-success" },
  amber:  { soft: "bg-warning-soft",  text: "text-warning" },
  ink:    { soft: "bg-muted",         text: "text-foreground" },
  violet: { soft: "bg-info-soft",     text: "text-info" },
};

/**
 * One stat tile for every dashboard. All colors map to BBDO tokens —
 * no raw Tailwind palette, no hardcoded hex.
 */
export default function StatCard({ label, value, delta, trend, icon: Icon, tone = "ink", className }: Props) {
  const t = toneMap[tone];
  return (
    <div className={cn("bbdo-surface-card p-4 flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="bbdo-eyebrow text-muted-foreground">{label}</span>
        {Icon && (
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", t.soft)}>
            <Icon className={cn("w-4 h-4", t.text)} strokeWidth={2} />
          </div>
        )}
      </div>
      <div className={cn("stat-lg", t.text)}>{value}</div>
      {delta && (
        <div
          className={cn(
            "text-xs font-medium",
            trend === "up" && "text-success",
            trend === "down" && "text-critical",
            (!trend || trend === "flat") && "text-muted-foreground",
          )}
        >
          {delta}
        </div>
      )}
    </div>
  );
}
