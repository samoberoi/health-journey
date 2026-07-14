import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { motion } from "framer-motion";

export interface PillChipProps {
  active?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md";
  variant?: "solid" | "outline" | "soft";
  className?: string;
}

export function PillChip({
  active = false,
  onClick,
  icon,
  children,
  size = "md",
  variant = "outline",
  className,
}: PillChipProps) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors ease-bbdo whitespace-nowrap";
  const sizeCls = size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]";

  const styles = active
    ? "bg-[var(--bbdo-blue)] text-white border border-[var(--bbdo-blue)]"
    : variant === "solid"
    ? "bg-[var(--bbdo-surface)] text-foreground border border-[var(--bbdo-line)]"
    : variant === "soft"
    ? "bg-[var(--bbdo-blue-soft)] text-[var(--bbdo-blue)] border border-transparent"
    : "bg-transparent text-muted-foreground border border-[var(--bbdo-line)]";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className={cn(base, sizeCls, styles, className)}
    >
      {icon}
      {children}
    </motion.button>
  );
}

export interface SegmentedTabsProps<T extends string> {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: SegmentedTabsProps<T>) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto no-scrollbar", className)}>
      {options.map((o) => (
        <PillChip
          key={o.value}
          active={value === o.value}
          onClick={() => onChange(o.value)}
          icon={o.icon}
          size={size}
        >
          {o.label}
        </PillChip>
      ))}
    </div>
  );
}

export default PillChip;
