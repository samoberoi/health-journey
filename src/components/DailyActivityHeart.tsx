import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Timer,
  Pill,
  Footprints,
  Dumbbell,
  Flower2,
  Droplet,
  Activity,
  Heart,
  Sparkles,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

export interface HeartRingItem {
  key: string;
  label: string;
  ratio: number; // 0..1
  color: string;
  hint?: string;
}

interface Props {
  items: HeartRingItem[];
  title?: string;
  size?: "md" | "lg";
}

// Heart silhouette used for both the outline and the segmented brush strokes.
const HEART_D =
  "M50,84 C10,62 4,32 24,16 C39,4 50,18 50,26 C50,18 61,4 76,16 C96,32 90,62 50,84";

const ICONS: Record<string, LucideIcon> = {
  fasting: Timer,
  supplements: Pill,
  movement: Footprints,
  exercise: Dumbbell,
  yoga: Flower2,
  water: Droplet,
  diabetes: Activity,
};

export default function DailyActivityHeart({
  items,
  title = "Daily activity",
  size = "md",
}: Props) {
  const safe = items.filter((i) => Number.isFinite(i.ratio));
  const n = safe.length;
  const done = safe.filter((i) => i.ratio >= 1).length;
  const allDone = n > 0 && done === n;

  // Measure segment midpoints so icon chips sit exactly on the heart perimeter.
  const measureRef = useRef<SVGPathElement | null>(null);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);

  useEffect(() => {
    const path = measureRef.current;
    if (!path || n === 0) return;
    const total = path.getTotalLength();
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      // Rotate start so the seam sits at the bottom point of the heart
      // (t=0 is at the bottom vertex in our path).
      const t = ((i + 0.5) / n) * total;
      const p = path.getPointAtLength(t);
      pts.push({ x: p.x, y: p.y });
    }
    setPoints(pts);
  }, [n]);

  const segLen = n > 0 ? 1 / n : 1;

  return (
    <motion.div
      className={`liquid-glass rounded-3xl relative overflow-hidden ${
        size === "lg" ? "p-6 md:p-7" : "p-5"
      }`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
            Today
          </p>
          <h3 className="text-foreground font-black text-base leading-tight">
            {title}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-foreground leading-none tabular-nums">
            {done}
            <span className="text-sm text-muted-foreground font-bold">
              /{n}
            </span>
          </p>
          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
            {allDone ? "All complete" : "in progress"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
      <div
        className={`relative shrink-0 ${
          size === "lg"
            ? "w-[220px] h-[210px] md:w-[260px] md:h-[240px]"
            : "w-[200px] h-[190px]"
        }`}
      >

        <svg
          viewBox="0 0 100 90"
          className="w-full h-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            {safe.map((it) => (
              <filter
                key={`glow-${it.key}`}
                id={`glow-${it.key}`}
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="0.8" />
              </filter>
            ))}
          </defs>

          {/* Hidden measurement path with pathLength=1 so dashes are simple 0..1 fractions */}
          <path
            ref={measureRef}
            d={HEART_D}
            fill="none"
            stroke="none"
            pathLength={1}
          />

          {/* Faint background heart to hint the silhouette */}
          <path
            d={HEART_D}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeOpacity={0.35}
            strokeWidth={10}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Segments */}
          {safe.map((it, i) => {
            const complete = it.ratio >= 1;
            const gap = 0.012; // small gap between segments
            const visible = Math.max(0, segLen - gap);
            // offset so seam is at bottom vertex (path starts there)
            const offset = -(i * segLen);
            const inactiveStroke = 8;
            const activeStroke = 11;
            return (
              <g key={it.key}>
                {/* Soft shadow under active brush */}
                {complete && (
                  <motion.path
                    d={HEART_D}
                    fill="none"
                    stroke={it.color}
                    strokeOpacity={0.35}
                    strokeWidth={activeStroke + 3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                    strokeDasharray={`${visible} ${1 - visible + 0.0001}`}
                    strokeDashoffset={offset}
                    filter={`url(#glow-${it.key})`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 + i * 0.04, duration: 0.22 }}
                  />
                )}
                {/* Brush stroke */}
                <motion.path
                  d={HEART_D}
                  fill="none"
                  stroke={it.color}
                  strokeOpacity={complete ? 1 : 0.22}
                  strokeWidth={complete ? activeStroke : inactiveStroke}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray={`${visible} ${1 - visible + 0.0001}`}
                  strokeDashoffset={offset}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: 0.1 + Math.min(i, 6) * 0.04,
                    duration: 0.22,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{ transformOrigin: "50px 45px" }}
                />
                {/* Partial progress sheen for in-progress segments */}
                {!complete && it.ratio > 0 && (
                  <path
                    d={HEART_D}
                    fill="none"
                    stroke={it.color}
                    strokeOpacity={0.75}
                    strokeWidth={activeStroke - 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                    strokeDasharray={`${visible * it.ratio} ${
                      1 - visible * it.ratio + 0.0001
                    }`}
                    strokeDashoffset={offset}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Icon chips positioned on each segment midpoint */}
        {points.map((p, i) => {
          const it = safe[i];
          if (!it) return null;
          const Icon = ICONS[it.key] ?? Heart;
          const complete = it.ratio >= 1;
          // Convert svg coord (viewBox 0..100 / 0..90) to percentage
          const leftPct = p.x; // viewBox x max = 100 → percent directly
          const topPct = (p.y / 90) * 100;
          return (
            <motion.div
              key={`chip-${it.key}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                delay: 0.35 + Math.min(i, 6) * 0.04,
                duration: 0.22,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div
                className="w-8 h-8 rounded-full bg-white flex items-center justify-center border"
                style={{
                  borderColor: complete ? it.color : "hsl(var(--border))",
                  boxShadow: complete
                    ? `0 4px 12px ${it.color}55, 0 1px 2px rgba(15,26,61,0.08)`
                    : "0 1px 3px rgba(15,26,61,0.08)",
                }}
                title={`${it.label}${it.hint ? ` · ${it.hint}` : ""}`}
              >
                <Icon
                  className="w-4 h-4"
                  style={{ color: complete ? it.color : "#94A3B8" }}
                  strokeWidth={2.4}
                />
              </div>
            </motion.div>
          );
        })}

        {/* Center readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.24 }}
            className="flex flex-col items-center"
          >
            <span className="text-5xl md:text-6xl font-black text-foreground leading-none tabular-nums">
              {done}
              <span className="text-xl font-bold text-muted-foreground">
                /{n}
              </span>
            </span>
            <span className="mt-1 text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
              {allDone ? (
                <span className="inline-flex items-center gap-1 text-[var(--bbdo-red)]">
                  <Sparkles className="w-3 h-3" /> complete
                </span>
              ) : (
                "pillars"
              )}
            </span>
          </motion.div>
        </div>
      </div>

      {/* Legend (right column) */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {safe.map((it) => {
          const complete = it.ratio >= 1;
          const pct = Math.round(Math.max(0, Math.min(1, it.ratio)) * 100);
          const Icon = ICONS[it.key] ?? Heart;
          return (
            <div key={`leg-${it.key}`} className="flex items-center gap-2 min-w-0">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: complete ? `${it.color}18` : "hsl(var(--muted))",
                }}
              >
                <Icon
                  className="w-3 h-3"
                  style={{ color: complete ? it.color : "#94A3B8" }}
                  strokeWidth={2.6}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-foreground truncate">
                    {it.label}
                  </span>
                  <span
                    className="text-[10px] font-black tabular-nums shrink-0"
                    style={{
                      color: complete ? it.color : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {complete ? <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.4} /> : `${pct}%`}
                  </span>
                </div>
                {it.hint && (
                  <p className="text-[9px] text-muted-foreground font-medium truncate">
                    {it.hint}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </motion.div>
  );

}
