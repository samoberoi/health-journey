import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import SoundToggle from "@/components/SoundToggle";
import { setPhase } from "@/lib/musicEngine";

export default function HopeScreen() {
  const navigate = useNavigate();
  useEffect(() => { setPhase("hope"); }, []);

  return (
    <div className="ob-screen phone-container ob-lock min-h-dvh overflow-x-hidden">
      <SoundToggle />
      <div className="ob-content">
        <motion.h1 className="ob-title mb-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>This is<br /><span className="text-primary">reversible.</span></motion.h1>
        <motion.p className="ob-sub mb-5 max-w-[280px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>With the right system, your body can heal.</motion.p>


        <motion.div className="liquid-glass-strong mb-3 w-full p-4 text-left" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-muted-foreground">What the science says</p>
          <p className="text-sm font-medium leading-6 text-foreground">"Up to <span className="text-primary font-bold">86%</span> of patients achieve normal glucose through sustained lifestyle changes."</p>
          <p className="mt-2 text-[0.65rem] text-muted-foreground">— The Lancet, 2024</p>
        </motion.div>

        <motion.div className="liquid-glass-strong mb-4 w-full p-4 text-left" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}>
          <p className="text-sm font-medium leading-6 text-foreground">"<span className="text-primary font-bold">Metabolic health</span> improves when lifestyle changes are sustained — not only blood glucose, but blood pressure, liver fat, cholesterol, PCOS and insulin sensitivity."</p>
          <p className="mt-2 text-[0.65rem] text-muted-foreground">— Diabetologia, 2024</p>
        </motion.div>

        <motion.div className="ob-bottom" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <motion.button onClick={() => navigate("/projection-preview")} className="ob-cta gradient-blue glow-blue" whileTap={{ scale: 0.98 }}>See my projection <ChevronRight className="h-5 w-5" /></motion.button>
        </motion.div>
      </div>
    </div>
  );
}
