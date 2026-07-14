import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  action?: { label: string; onClick: () => void };
  right?: ReactNode;
  className?: string;
}

export function SectionHeader({ eyebrow, title, action, right, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="bbdo-eyebrow text-muted-foreground mb-1">{eyebrow}</div>}
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-foreground truncate">{title}</h2>
      </div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-[var(--bbdo-blue)] hover:opacity-80 transition-opacity ease-bbdo"
        >
          {action.label}
          <ChevronRight className="w-4 h-4" strokeWidth={2} />
        </button>
      ) : (
        right
      )}
    </div>
  );
}

export default SectionHeader;
