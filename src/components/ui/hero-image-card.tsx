import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { motion } from "framer-motion";

export interface HeroImageCardProps {
  image: string;
  title: string;
  subtitle?: string;
  metaPill?: ReactNode;
  bottomLeft?: ReactNode;
  bottomRight?: ReactNode;
  aspect?: "square" | "video" | "wide" | "tall";
  overlay?: "soft" | "strong";
  className?: string;
  onClick?: () => void;
  children?: ReactNode;
}

const aspectMap = {
  square: "aspect-square",
  video: "aspect-video",
  wide: "aspect-[16/9]",
  tall: "aspect-[3/4]",
};

export function HeroImageCard({
  image,
  title,
  subtitle,
  metaPill,
  bottomLeft,
  bottomRight,
  aspect = "video",
  overlay = "soft",
  className,
  onClick,
  children,
}: HeroImageCardProps) {
  return (
    <motion.div
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-[24px] group",
        aspectMap[aspect],
        onClick && "cursor-pointer",
        className,
      )}
    >
      <img
        src={image}
        alt={title}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-bbdo group-hover:scale-[1.02]"
      />
      <div
        className={cn(
          "absolute inset-0",
          overlay === "soft"
            ? "bg-gradient-to-t from-[rgba(15,26,61,0.85)] via-[rgba(15,26,61,0.25)] to-transparent"
            : "bg-gradient-to-t from-[rgba(15,26,61,0.95)] via-[rgba(15,26,61,0.55)] to-[rgba(15,26,61,0.15)]",
        )}
      />
      {metaPill && <div className="absolute top-3 right-3 z-10">{metaPill}</div>}
      <div className="absolute inset-x-0 bottom-0 p-4 z-10 text-white">
        <h3 className="text-lg font-bold leading-tight tracking-[-0.02em] line-clamp-2">{title}</h3>
        {subtitle && <p className="mt-1 text-[13px] text-white/85 line-clamp-1">{subtitle}</p>}
        {(bottomLeft || bottomRight) && (
          <div className="mt-2 flex items-end justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-white/90">{bottomLeft}</div>
            {bottomRight && <div>{bottomRight}</div>}
          </div>
        )}
        {children}
      </div>
    </motion.div>
  );
}

export default HeroImageCard;
