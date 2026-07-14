import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function AttentionBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;

  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-md bg-destructive text-[10px] font-black leading-none text-destructive-foreground shadow-card",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </motion.span>
  );
}