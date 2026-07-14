import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

export interface ScreenHeaderProps {
  title?: string;
  eyebrow?: string;
  onBack?: () => void;
  right?: ReactNode;
  className?: string;
}

export function ScreenHeader({ title, eyebrow, onBack, right, className }: ScreenHeaderProps) {
  return (
    <div className={cn("flex items-center gap-3 px-5 pt-4 pb-3", className)}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white border border-[var(--bbdo-line)] flex items-center justify-center shadow-card ios-tap"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" strokeWidth={1.75} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        {eyebrow && <div className="bbdo-eyebrow text-muted-foreground">{eyebrow}</div>}
        {title && <h1 className="text-[22px] font-bold tracking-[-0.02em] text-foreground truncate">{title}</h1>}
      </div>
      {right}
    </div>
  );
}

export default ScreenHeader;
