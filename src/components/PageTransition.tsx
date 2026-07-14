import { ReactNode, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigationType } from "react-router-dom";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Directional page transition — clean, glitch-free.
 *
 * - Forward (PUSH/REPLACE): subtle right→left slide + fade in
 * - Back (POP): subtle left→right slide + fade in
 * - Exit: pure fade (no slide) — avoids the outgoing page shifting under
 *   the incoming one and causing a visible jump.
 *
 * After the enter animation settles, we clear inline `transform` so children
 * with `position: fixed`, `backdrop-filter`, or hover effects don't glitch
 * inside a transformed ancestor.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navType = useNavigationType();
  const isBack = navType === "POP";
  // Full-width slide-in feel — new screen slides across from the right on
  // forward nav, from the left on back. Combined with AnimatePresence
  // mode="wait", the outgoing screen slides off first, giving a clear
  // native-app style transition.
  const enterFrom = isBack ? "-100%" : "100%";
  const exitTo = isBack ? "100%" : "-100%";
  const ref = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={ref}
      key={location.pathname}
      initial={{ opacity: 0, x: enterFrom }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: exitTo }}
      transition={{
        opacity: { duration: 0.22, ease: EASE },
        x: { duration: 0.36, ease: EASE },
      }}
      onAnimationComplete={(def) => {
        // Only clear after the enter animation (not exit)
        if (typeof def === "object" && def && "opacity" in (def as any)) {
          const el = ref.current;
          if (el) {
            el.style.transform = "";
            el.style.willChange = "";
          }
        }
      }}
      style={{
        width: "100%",
        minHeight: "100dvh",
        overflowX: "hidden",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </motion.div>
  );
}
