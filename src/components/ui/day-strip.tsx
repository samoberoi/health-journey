import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface DayStripProps {
  days?: number;
  selectedDate?: Date;
  onSelect?: (d: Date) => void;
  markedDates?: Set<string>;
  className?: string;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const key = (d: Date) => d.toISOString().slice(0, 10);

export function DayStrip({ days = 7, selectedDate, onSelect, markedDates, className }: DayStripProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = selectedDate ? new Date(selectedDate) : today;
  selected.setHours(0, 0, 0, 0);

  const list: Date[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    list.push(d);
  }

  return (
    <div className={cn("flex gap-2 overflow-x-auto no-scrollbar", className)}>
      {list.map((d) => {
        const isSelected = key(d) === key(selected);
        const isToday = key(d) === key(today);
        const isMarked = markedDates?.has(key(d));
        return (
          <motion.button
            key={key(d)}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.1, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => onSelect?.(d)}
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl w-12 h-16 flex-shrink-0 transition-colors ease-bbdo border",
              isSelected
                ? "bg-[var(--bbdo-blue)] text-white border-[var(--bbdo-blue)]"
                : "bg-white text-foreground border-[var(--bbdo-line)]",
            )}
          >
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider", isSelected ? "text-white/80" : "text-muted-foreground")}>
              {DOW[d.getDay()]}
            </span>
            <span className="stat-number text-lg leading-tight mt-0.5">{d.getDate()}</span>
            <span
              className={cn(
                "mt-1 w-1 h-1 rounded-full",
                isMarked
                  ? isSelected
                    ? "bg-white"
                    : "bg-[var(--bbdo-red)]"
                  : isToday && !isSelected
                  ? "bg-[var(--bbdo-blue)]"
                  : "bg-transparent",
              )}
            />
          </motion.button>
        );
      })}
    </div>
  );
}

export default DayStrip;
