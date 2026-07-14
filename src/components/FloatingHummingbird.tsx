import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import hummingbirdImg from "@/assets/hummingbird.png";

// Pages where the hummingbird SHOULD appear
const VISIBLE_ROUTES = ["/home"];

export default function FloatingHummingbird() {
  const location = useLocation();
  const [position, setPosition] = useState({ x: 85, y: 12 });
  const [flip, setFlip] = useState(false);

  const visible = VISIBLE_ROUTES.includes(location.pathname);

  useEffect(() => {
    if (!visible) return;
    const corners = [
      { x: 80 + Math.random() * 15, y: 8 + Math.random() * 10 },
      { x: 5 + Math.random() * 15, y: 8 + Math.random() * 10 },
      { x: 75 + Math.random() * 20, y: 60 + Math.random() * 20 },
      { x: 5 + Math.random() * 10, y: 55 + Math.random() * 20 },
    ];
    const pick = corners[Math.floor(Math.random() * corners.length)];
    setFlip(pick.x < 50);
    setPosition(pick);
  }, [location.pathname, visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed z-50 pointer-events-none"
          style={{ left: `${position.x}%`, top: `${position.y}%` }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            src={hummingbirdImg}
            alt=""
            className="w-10 h-10 object-contain"
            width={512}
            height={512}
            loading="lazy"
            style={{
              transform: flip ? "scaleX(-1)" : "none",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
