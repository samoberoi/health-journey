import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppIcon, AppIconName } from "@/components/ui/AppIcon";

interface TopBarProps {
  left?: ReactNode;
  title?: ReactNode;
  actions?: Array<{ icon: AppIconName; onClick?: () => void; badge?: number; label?: string }>;
  avatar?: ReactNode;
  className?: string;
}

/** App-wide top bar — wordmark / title on the left, circular icon buttons + avatar on the right. */
export function TopBar({ left, title, actions = [], avatar, className }: TopBarProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3 pt-2", className)}>
      <div className="min-w-0 flex-1 flex items-center gap-2">
        {left}
        {title && (
          <h1 className="text-[26px] font-extrabold leading-none tracking-tight text-bbdo-ink truncate">
            {title}
          </h1>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions.map((a, i) => (
          <button key={i} onClick={a.onClick} className="top-icon-btn ios-tap relative" aria-label={a.label}>
            <AppIcon name={a.icon} size={18} />
            {(a.badge ?? 0) > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full grid place-items-center text-[10px] font-bold text-white"
                style={{ background: "var(--bbdo-red)" }}
              >
                {a.badge! > 9 ? "9+" : a.badge}
              </span>
            )}
          </button>
        ))}
        {avatar}
      </div>
    </div>
  );
}
