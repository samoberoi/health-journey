import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: "default" | "muted";
  className?: string;
}

/**
 * Single empty-state block for every role.
 * Replaces plain `<p>No X yet</p>` scattered across tabs, coach, admin, partner.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "default",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "w-full flex flex-col items-center justify-center text-center gap-3 py-10 px-6",
        tone === "muted" && "text-muted-foreground",
        className,
      )}
    >
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <Icon className="w-6 h-6 text-muted-foreground" strokeWidth={1.75} />
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-xs">
        <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-snug">{description}</p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
