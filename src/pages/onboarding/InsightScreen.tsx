import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Lock, AlertTriangle, RefreshCw } from "lucide-react";
import SoundToggle from "@/components/SoundToggle";
import { setPhase } from "@/lib/musicEngine";

const insights = [
  { title: "Insulin Resistance", desc: "When your cells stop responding to insulin, glucose stays in your blood.", icon: Lock },
  { title: "Visceral Fat", desc: "Fat around organs worsens insulin resistance — a vicious cycle.", icon: AlertTriangle },
  { title: "Lifestyle Triggers", desc: "Poor sleep, stress, and sedentary habits amplify metabolic dysfunction.", icon: RefreshCw },
];

export default function InsightScreen() {
  const navigate = useNavigate();
  useEffect(() => { setPhase("hope"); }, []);

  return (
    <div className="ob-screen phone-container ob-lock min-h-dvh overflow-x-hidden">
      <SoundToggle />
      <div className="ob-content">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <span className="ob-kicker !text-destructive mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> Understanding Your Body</span>
          <h1 className="ob-title mt-2">Here's what's happening <span className="text-primary">inside.</span></h1>
        </motion.div>
        <div className="ob-stack flex-1">
          {insights.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div key={i} className="liquid-glass p-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.15 }}>
                <div className="flex items-start gap-3">
                  <div className="ob-icon mt-0.5 liquid-glass-icon tile-icon-red"><Icon className="h-5 w-5 text-[color:var(--bbdo-red)]" strokeWidth={1.5} /></div>
                  <div>
                    <p className="mb-1 text-sm font-bold text-foreground">{item.title}</p>
                    <p className="text-xs leading-5 text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        <motion.div className="ob-bottom" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <motion.button onClick={() => navigate("/hope")} className="ob-cta gradient-blue glow-blue" whileTap={{ scale: 0.98 }}>So what can I do? <ChevronRight className="h-5 w-5" /></motion.button>
        </motion.div>
      </div>
    </div>
  );
}
