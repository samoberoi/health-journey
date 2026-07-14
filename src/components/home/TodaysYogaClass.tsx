import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, Video, CheckCircle2, ExternalLink } from "lucide-react";
import { fetchTodaysYogaClasses, type TodayYogaClass } from "@/lib/yogaBookingService";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function statusOf(c: TodayYogaClass, now: number): "upcoming" | "live" | "done" {
  const start = new Date(c.scheduled_at).getTime();
  const end = new Date(c.ends_at).getTime();
  if (now < start) return "upcoming";
  if (now <= end) return "live";
  return "done";
}

export default function TodaysYogaClass() {
  const [classes, setClasses] = useState<TodayYogaClass[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodaysYogaClasses()
      .then(setClasses)
      .finally(() => setLoading(false));
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  if (loading || classes.length === 0) return null;


  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl p-5 bg-card ring-1 ring-border shadow-card"
    >
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
        <Calendar className="w-3.5 h-3.5" /> Today's Yoga Class
      </div>

      <div className="mt-3 space-y-2.5">
        {classes.map((c) => {
          const s = statusOf(c, now);
          const label =
            c.package_type === "group" ? "Group class" : "1:1 private class";
          return (
            <div
              key={`${c.booking_id}-${c.scheduled_at}`}
              className="rounded-2xl p-3.5 bg-background ring-1 ring-border/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground truncate">
                    {label}
                    {c.partner_name ? ` · ${c.partner_name}` : ""}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" /> {fmtTime(c.scheduled_at)} · {c.duration_min} min
                  </p>
                </div>
                {s === "live" && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live
                  </span>
                )}
                {s === "upcoming" && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    Upcoming
                  </span>
                )}
                {s === "done" && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" /> Completed
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {s !== "done" && c.meet_link && (
                  <a
                    href={c.meet_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-card transition hover:opacity-90"
                  >
                    <Video className="w-3.5 h-3.5" />
                    {s === "live" ? "Join class now" : "Open meet link"}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {s !== "done" && !c.meet_link && (
                  <p className="text-[11px] text-muted-foreground">
                    Your instructor will share the meet link before class.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
