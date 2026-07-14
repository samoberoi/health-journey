import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { colorForValue, gradientStopsForModule, useColorGauges } from "@/hooks/useColorGauges";

interface HealthScoreRingProps {
  score: number;
  size?: number;
  thickness?: number;
  showSubtitle?: boolean;
  subtitle?: string;
  className?: string;
  scoreClassName?: string;
  subtitleClassName?: string;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
}

export default function HealthScoreRing({
  score,
  size = 180,
  thickness = 12,
  showSubtitle = true,
  subtitle = "out of 100",
  className,
  scoreClassName,
  subtitleClassName,
}: HealthScoreRingProps) {
  const [animated, setAnimated] = useState(0);
  const { modules } = useColorGauges();
  const stops = gradientStopsForModule(modules, "health_score");
  const solidColor = colorForValue(modules, "health_score", score);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(clampScore(score)), 250);
    return () => clearTimeout(timer);
  }, [score]);

  const pct = clampScore(animated);
  const trackColor = "hsl(var(--muted))";
  const progressOffset = pct / 100;
  const visibleStops = stops.filter((s) => s.offset <= progressOffset);
  const progressStops = stops.length >= 2
    ? [
        ...(visibleStops.length ? visibleStops : [{ offset: 0, color: solidColor }]),
        { offset: progressOffset, color: solidColor },
      ]
        .sort((a, b) => a.offset - b.offset)
        .map((s) => `${s.color} ${(s.offset * 100).toFixed(2)}%`)
        .join(", ")
    : `${solidColor} 0%, ${solidColor} ${pct}%`;
  const conicCss = pct >= 100
    ? `conic-gradient(from -90deg, ${progressStops})`
    : `conic-gradient(from -90deg, ${progressStops}, ${trackColor} ${pct}%, ${trackColor} 100%)`;
  const trackMask = `radial-gradient(circle, transparent ${(size / 2) - thickness}px, #000 ${(size / 2) - thickness + 0.5}px, #000 ${size / 2}px, transparent ${(size / 2) + 0.5}px)`;

  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: conicCss,
          WebkitMask: trackMask,
          mask: trackMask,
        }}
      />

      <div className="absolute flex flex-col items-center justify-center gap-1 text-center">
        <motion.span
          className={cn("font-black text-foreground leading-none tabular-nums", scoreClassName ?? "text-5xl")}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {Math.round(score)}
        </motion.span>
        {showSubtitle && (
          <span className={cn("text-muted-foreground text-xs font-medium", subtitleClassName)}>{subtitle}</span>
        )}
      </div>
    </div>
  );
}