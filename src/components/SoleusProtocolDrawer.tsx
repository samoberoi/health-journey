import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Dumbbell, X } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useAuth } from "@/contexts/AuthContext";
import { useSoleusSessionsToday } from "@/hooks/useSoleusSessionsToday";
import {
  SOLEUS_PROTOCOL_VIDEO,
  getSoleusVideoConfig,
  recordSoleusSession,
} from "@/lib/soleusProtocol";
import { isNativeIOSApp, youtubePlayerProxyUrl } from "@/lib/youtubeEmbed";
import NativeYouTubePlayer from "@/components/exercises/NativeYouTubePlayer";

export default function SoleusProtocolDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const { count, goal, completed, refresh } = useSoleusSessionsToday();
  const [saving, setSaving] = useState(false);
  const [videoId, setVideoId] = useState(SOLEUS_PROTOCOL_VIDEO.youtubeId);
  const [useNativePlayer] = useState(() => isNativeIOSApp());

  useEffect(() => {
    let cancelled = false;
    getSoleusVideoConfig().then((v) => { if (!cancelled) setVideoId(v.youtubeId); });
    return () => { cancelled = true; };
  }, []);

  const embedSrc = useMemo(
    () => youtubePlayerProxyUrl(videoId, { autoplay: false }),
    [videoId],
  );

  const onComplete = async () => {
    if (!user) { toast.error("Please sign in"); return; }
    if (completed) {
      toast.success("You've already closed today's loop 🎉");
      return;
    }
    setSaving(true);
    const ok = await recordSoleusSession(user.id, "manual");
    setSaving(false);
    if (ok) {
      await refresh();
      const next = Math.min(goal, count + 1);
      if (next >= goal) toast.success("Soleus Push-Ups complete for today ✨");
      else toast.success(`Round ${next} of ${goal} logged`);
    } else {
      toast.error("Couldn't save this round. Try again.");
    }
  };

  const progressPct = Math.min(100, Math.round((count / goal) * 100));

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background border-t border-border px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[92dvh] overflow-y-auto overscroll-contain">
        <DrawerHeader className="px-0 pb-2 flex-row items-center justify-between">
          <DrawerTitle className="text-foreground text-lg font-black flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--bbdo-blue)" }}>
              <Dumbbell className="w-[18px] h-[18px] text-white" strokeWidth={1.8} />
            </span>
            Soleus Push-Ups
          </DrawerTitle>
          <button aria-label="Close" onClick={() => onOpenChange(false)} className="no-pill w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </DrawerHeader>

        <p className="text-[13px] text-muted-foreground leading-snug">
          {SOLEUS_PROTOCOL_VIDEO.description}
        </p>

        {/* Progress bar */}
        <div className="mt-3 rounded-2xl bg-card border border-border p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">Today</span>
            <span className="text-xs font-black tabular-nums" style={{ color: completed ? "#10B981" : "var(--bbdo-blue)" }}>
              {count}/{goal} rounds
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full"
              style={{ background: completed ? "#10B981" : "var(--bbdo-blue)" }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
            {completed
              ? "Beautifully done — you've completed all 3 rounds today."
              : `Do a round after each meal. ${goal - count} more round${goal - count === 1 ? "" : "s"} to close today's loop.`}
          </p>
        </div>

        {/* Video */}
        <div className="mt-3 rounded-2xl overflow-hidden bg-black border border-border relative" style={{ aspectRatio: "16 / 9" }}>
          {useNativePlayer ? (
            <NativeYouTubePlayer
              key={videoId}
              videoId={videoId}
              title="BBDO Soleus Push-Ups"
              start={0}
            />
          ) : (
            <iframe
              key={embedSrc}
              src={embedSrc}
              title="BBDO Soleus Push-Ups"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 w-full h-full"
            />
          )}
        </div>

        <button
          onClick={onComplete}
          disabled={saving || completed}
          className="mt-3 w-full h-14 rounded-2xl text-white font-bold text-[15px] disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{ background: completed ? "#10B981" : "var(--bbdo-blue)" }}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : completed ? (
            <><CheckCircle2 className="w-4 h-4" /> All 3 rounds done today</>
          ) : (
            <>Mark this round complete ({count + 1}/{goal})</>
          )}
        </button>

        <p className="text-[11px] text-muted-foreground text-center mt-2 leading-snug">
          Ritual · After breakfast · After lunch · After dinner
        </p>
      </DrawerContent>
    </Drawer>
  );
}
