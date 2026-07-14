import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subYears, startOfDay, endOfDay } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type RangePreset =
  | "this_month"
  | "last_month"
  | "last_quarter"
  | "last_6_months"
  | "last_year"
  | "custom";

export interface DateRange {
  from: Date;
  to: Date;
  preset: RangePreset;
  label: string;
}

const PRESETS: { key: Exclude<RangePreset, "custom">; label: string }[] = [
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "last_quarter", label: "Last Quarter" },
  { key: "last_6_months", label: "Last 6 Months" },
  { key: "last_year", label: "Last Year" },
];

export const rangeFor = (preset: Exclude<RangePreset, "custom">): DateRange => {
  const now = new Date();
  switch (preset) {
    case "this_month":
      return { preset, from: startOfMonth(now), to: endOfMonth(now), label: "This Month" };
    case "last_month": {
      const ref = subMonths(now, 1);
      return { preset, from: startOfMonth(ref), to: endOfMonth(ref), label: "Last Month" };
    }
    case "last_quarter":
      return { preset, from: startOfDay(subMonths(now, 3)), to: endOfDay(now), label: "Last Quarter" };
    case "last_6_months":
      return { preset, from: startOfDay(subMonths(now, 6)), to: endOfDay(now), label: "Last 6 Months" };
    case "last_year":
      return { preset, from: startOfDay(subYears(now, 1)), to: endOfDay(now), label: "Last Year" };
  }
};

export const defaultRange = (): DateRange => rangeFor("this_month");

interface Props {
  value: DateRange;
  onChange: (r: DateRange) => void;
  align?: "start" | "end";
}

export default function DateRangeFilter({ value, onChange, align = "end" }: Props) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>(value.preset === "custom" ? value.from : undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(value.preset === "custom" ? value.to : undefined);

  const display = useMemo(() => {
    if (value.preset === "custom") {
      return `${format(value.from, "d MMM")} → ${format(value.to, "d MMM yyyy")}`;
    }
    return value.label;
  }, [value]);

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    const from = startOfDay(customFrom);
    const to = endOfDay(customTo);
    onChange({
      preset: "custom",
      from,
      to,
      label: `${format(from, "d MMM")} → ${format(to, "d MMM yyyy")}`,
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <CalendarIcon className="w-4 h-4" />
          <span className="text-xs font-semibold">{display}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        <div className="flex">
          <div className="p-2 border-r border-border min-w-[160px] space-y-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  onChange(rangeFor(p.key));
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors",
                  value.preset === p.key
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {p.label}
              </button>
            ))}
            <div className="pt-1 mt-1 border-t border-border">
              <p className="px-3 pt-1 text-[10px] uppercase tracking-wide text-muted-foreground">Custom range</p>
            </div>
          </div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">From</p>
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={setCustomFrom}
                  className={cn("p-0 pointer-events-auto")}
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">To</p>
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={setCustomTo}
                  className={cn("p-0 pointer-events-auto")}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={applyCustom} disabled={!customFrom || !customTo}>
                Apply custom range
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
