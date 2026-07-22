import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, TrendingUp, HeartPulse, Sparkles } from "lucide-react";
import SoundToggle from "@/components/SoundToggle";
import { setPhase } from "@/lib/musicEngine";

export default function ProjectionPreview() {
  const navigate = useNavigate();
  useEffect(() => { setPhase("hope"); }, []);

  const projections = [
    { icon: HeartPulse, label: "Metabolic Health", current: "Today", projected: "Stronger" },
    { icon: TrendingUp, label: "Daily Energy", current: "Today", projected: "Steadier" },
    { icon: Sparkles, label: "Overall Wellbeing", current: "Today", projected: "Better" },
  ];

  return (
    <div className="phone-container ob-lock min-h-dvh flex flex-col px-6 pt-[calc(env(safe-area-inset-top)+2rem)] mobile-bottom-safe bg-background">
      <SoundToggle />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <span className="text-xs font-semibold text-primary uppercase tracking-[0.2em]">Your Potential</span>
        <h1 className="text-[26px] font-black text-foreground mt-2 mb-1 leading-[1.1]">A healthier you,<br /><span className="text-primary">within reach</span></h1>
        <p className="text-muted-foreground text-[13px]">Here's what a structured plan can unlock for you.</p>
      </motion.div>

      <div className="flex flex-col gap-2.5">
        {projections.map((p, i) => {
          const Icon = p.icon;
          return (
            <motion.div key={i} className="liquid-glass rounded-2xl p-4" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.15 }}>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl liquid-glass-icon tile-icon-violet flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{p.label}</p>
                  <div className="flex items-center gap-3">
                    <span className="stat-number text-xl text-primary">{p.projected}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div className="liquid-glass mt-3 rounded-2xl p-3 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
        <p className="text-[12px] leading-5 text-muted-foreground">For a sharper projection, we need a few more details about your health.</p>
      </motion.div>

      <motion.div className="ob-bottom" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>
        <motion.button onClick={() => navigate("/setup/deep-profiling")} className="ob-cta gradient-blue glow-blue" whileTap={{ scale: 0.98 }}>
          Continue to detailed assessment <ChevronRight className="h-5 w-5" />
        </motion.button>
      </motion.div>
    </div>
  );
}