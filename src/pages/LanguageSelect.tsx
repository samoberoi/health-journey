import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AppIcon } from "@/components/ui/AppIcon";
import { SubCard } from "@/components/ui/SubCard";
import { HeroCard } from "@/components/ui/HeroCard";
import { Fab } from "@/components/ui/Fab";
import { Loader2 } from "lucide-react";
import { useAppLanguages } from "@/hooks/useAppLanguages";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/i18n";

const STORAGE_KEY = "bb_language";

export default function LanguageSelect() {
  const navigate = useNavigate();
  const { languages, loading } = useAppLanguages({ onlyEnabled: true });
  const { setLang } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) {
        navigate("/reality-hook", { replace: true });
      }
    } catch { /* ignore */ }
  }, [navigate]);

  useEffect(() => {
    if (!loading && languages.length === 1) {
      setLang(languages[0].code as Language);
      navigate("/reality-hook", { replace: true });
    }
  }, [loading, languages, navigate, setLang]);

  const confirm = () => {
    if (!selected) return;
    setLang(selected as Language);
    navigate("/reality-hook");
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background px-5 pt-14 pb-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col flex-1 gap-5"
      >
        <HeroCard variant="navy" className="pb-8">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 grid place-items-center mb-4">
            <AppIcon name="globe" size={22} />
          </div>
          <h1 className="text-[34px] leading-[1.02] font-extrabold tracking-tight">
            Choose your <br /> language
          </h1>
          <p className="text-sm mt-2 text-white/70">You can change this anytime from your profile.</p>
        </HeroCard>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-bbdo-inksoft" />
          </div>
        ) : languages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-bbdo-inksoft">
            No languages available yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 flex-1">
            {languages.map((l) => {
              const active = selected === l.code;
              return (
                <motion.button
                  key={l.code}
                  onClick={() => setSelected(l.code)}
                  whileTap={{ scale: 0.98 }}
                  className="text-left"
                >
                  <SubCard
                    tight
                    className={`flex items-center gap-3 transition-colors ${active ? "ring-2 ring-bbdo-ink" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-extrabold text-bbdo-ink tracking-tight">{l.native_name || l.name}</p>
                      {l.native_name && l.native_name !== l.name && (
                        <p className="text-xs text-bbdo-inksoft mt-0.5">{l.name}</p>
                      )}
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full grid place-items-center shrink-0 transition-colors ${
                        active ? "bg-bbdo-ink text-white" : "bg-bbdo-cream2 text-transparent"
                      }`}
                    >
                      <AppIcon name="check" size={14} strokeWidth={2.4} />
                    </div>
                  </SubCard>
                </motion.button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-bbdo-inksoft">{selected ? "Ready to continue" : "Pick a language"}</p>
          <Fab onClick={confirm} disabled={!selected} className={!selected ? "opacity-40 pointer-events-none" : ""} aria-label="Continue">
            <AppIcon name="arrowRight" size={22} />
          </Fab>
        </div>
      </motion.div>
    </div>
  );
}
