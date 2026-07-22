import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Users, Compass, CalendarCheck, HeartHandshake } from "lucide-react";
import SoundToggle from "@/components/SoundToggle";
import { setPhase } from "@/lib/musicEngine";

const supports = [
  { icon: CalendarCheck, label: "Your daily plan", desc: "Meals, movement, and habits mapped out" },
  { icon: Users, label: "Your community", desc: "Thousands walking this journey with you" },
  { icon: HeartHandshake, label: "Your support system", desc: "Coaching, guidance, and regular check-ins" },
  { icon: Compass, label: "Expert Guidance", desc: "Coach Review and Close Support" },

];

export default function CommitmentScreen() {
  const navigate = useNavigate();
  useEffect(() => { setPhase("power"); }, []);

  return (
    <div className="ob-screen phone-container ob-lock min-h-dvh overflow-x-hidden">
      <SoundToggle />
      <div className="ob-content">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="ob-title">You are <span className="text-primary">not</span> doing this alone.</h1>
          <p className="ob-sub mt-2">Your complete support system is ready.</p>
        </motion.div>
        <div className="ob-stack flex-1">
          {supports.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div key={i} className="liquid-glass flex items-center gap-4 px-4 py-3.5" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }}>
                <div className="ob-icon liquid-glass-icon tile-icon-amber"><Icon className="h-5 w-5 text-[color:var(--bbdo-amber)]" strokeWidth={1.5} /></div>
                <div>
                  <p className="text-sm font-bold text-foreground">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
        <motion.div className="ob-bottom" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <motion.button onClick={() => navigate("/payment")} className="ob-cta gradient-blue glow-blue" whileTap={{ scale: 0.98 }}>Start My Transformation <ArrowRight className="h-5 w-5" /></motion.button>
        </motion.div>
      </div>
    </div>
  );
}
