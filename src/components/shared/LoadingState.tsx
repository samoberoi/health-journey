import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "inline" | "page" | "card";

interface Props {
  variant?: Variant;
  label?: string;
  className?: string;
}

/**
 * Single spinner for the whole app. Replaces every ad-hoc
 * `Loader2 animate-spin`, `div.border-t-primary`, or plain
 * "Loading…" string across all roles.
 */
export default function LoadingState({ variant = "inline", label, className }: Props) {
  const message = label ?? "Loading…";

  if (variant === "page") {
    return (
      <div className={cn("min-h-[50vh] w-full flex flex-col items-center justify-center gap-3 text-muted-foreground", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-primary" strokeWidth={2} />
        <span className="text-sm font-medium">{message}</span>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={cn("w-full py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground", className)}>
        <Loader2 className="w-5 h-5 animate-spin text-primary" strokeWidth={2} />
        <span className="text-xs font-medium">{message}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
      <Loader2 className="w-4 h-4 animate-spin text-primary" strokeWidth={2} />
      <span className="text-sm">{message}</span>
    </div>
  );
}
