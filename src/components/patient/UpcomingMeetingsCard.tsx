import { useEffect, useState } from "react";
import { Calendar, Clock, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUpcomingMeetingsForUser, meetingTypeLabel, type CoachMeeting } from "@/lib/meetingService";
import { supabase } from "@/integrations/supabase/client";
import { whatsappCallUrl, isMeetingCallable } from "@/lib/coachAvailability";

export default function UpcomingMeetingsCard() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<CoachMeeting[]>([]);
  const [coachPhones, setCoachPhones] = useState<Record<string, { phone: string | null; name: string | null }>>({});
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchUpcomingMeetingsForUser(user.id).then(async (ms) => {
      setMeetings(ms);
      const ids = Array.from(new Set(ms.map((m) => m.coach_id)));
      if (ids.length) {
        const { data } = await supabase.from("coaches").select("id, phone, name").in("id", ids);
        const map: Record<string, { phone: string | null; name: string | null }> = {};
        (data ?? []).forEach((c: any) => (map[c.id] = { phone: c.phone ?? null, name: c.name ?? null }));
        setCoachPhones(map);
      }
    });
  }, [user]);

  // Re-render every 30s so the Call Now button appears at start time.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (meetings.length === 0) return null;

  return (
    <div className="liquid-glass rounded-3xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-5 h-5 text-primary" strokeWidth={1.8} />
        <span className="text-foreground font-bold">Upcoming meeting{meetings.length > 1 ? "s" : ""}</span>
      </div>
      <div className="space-y-2.5">
        {meetings.slice(0, 3).map((m) => {
          const d = new Date(m.scheduled_at);
          const coach = coachPhones[m.coach_id];
          const callable = isMeetingCallable(m.scheduled_at, m.duration_min ?? 30);
          return (
            <div key={m.id} className="rounded-2xl bg-primary/5 border border-primary/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wide">{meetingTypeLabel(m.meeting_type)}</p>
                  <p className="text-foreground text-sm font-semibold mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    {d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} • {d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {coach?.name && <p className="text-[11px] text-muted-foreground mt-0.5">with {coach.name}</p>}
                  {m.agenda && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.agenda}</p>}
                </div>
                {callable && coach?.phone ? (
                  <a
                    href={whatsappCallUrl(coach.phone, `Hi ${coach.name ?? "Coach"}, joining our scheduled call now.`)}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-500 text-white rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-lift"
                  >
                    <Phone className="w-3.5 h-3.5" /> Call Now
                  </a>
                ) : (
                  <span className="text-[10px] font-semibold text-muted-foreground shrink-0">WhatsApp video</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
