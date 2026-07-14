import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  bbClassName?: string;
  doClassName?: string;
}

/**
 * BBDO wordmark — "BB" in brand red, "DO" in brand blue.
 * Use everywhere the BBDO logo/text appears.
 */
export default function BbdoWordmark({ className, bbClassName, doClassName }: Props) {
  return (
    <span className={cn("font-black tracking-tight inline-flex", className)}>
      <span className={cn("text-[hsl(var(--critical))]", bbClassName)} style={{ color: "var(--bbdo-red)" }}>BB</span>
      <span className={cn("text-[hsl(var(--info))]", doClassName)} style={{ color: "var(--bbdo-blue)" }}>DO</span>
    </span>
  );
}
