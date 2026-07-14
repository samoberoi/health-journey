/**
 * Returns whether the coach is currently within their working-hours window,
 * evaluated in the coach's own timezone.
 */
export interface CoachAvailability {
  available: boolean;
  startLabel: string; // e.g. "9:00 AM"
  endLabel: string;   // e.g. "6:00 PM"
  timezoneLabel: string; // e.g. "IST"
  windowLabel: string; // e.g. "9:00 AM – 6:00 PM IST"
  nowLabel: string;    // coach-local time e.g. "10:42 AM"
}

const TZ_SHORT: Record<string, string> = {
  "Asia/Kolkata": "IST",
  "America/New_York": "ET",
  "America/Los_Angeles": "PT",
  "Europe/London": "GMT",
  "UTC": "UTC",
};

function parseTime(t: string | null | undefined): { h: number; m: number } | null {
  if (!t) return null;
  const [hh, mm] = t.split(":");
  const h = Number(hh);
  const m = Number(mm ?? "0");
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { h, m };
}

function fmt12(h: number, m: number) {
  const period = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  const mm = m.toString().padStart(2, "0");
  return `${hh}:${mm} ${period}`;
}

function getPartsInTz(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit",
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { h, m };
}

export function getCoachAvailability(coach: {
  working_hours_start?: string | null;
  working_hours_end?: string | null;
  working_timezone?: string | null;
}): CoachAvailability {
  const tz = coach.working_timezone || "Asia/Kolkata";
  const start = parseTime(coach.working_hours_start) ?? { h: 9, m: 0 };
  const end = parseTime(coach.working_hours_end) ?? { h: 18, m: 0 };

  let now: { h: number; m: number };
  try {
    now = getPartsInTz(new Date(), tz);
  } catch {
    now = getPartsInTz(new Date(), "Asia/Kolkata");
  }

  const startMin = start.h * 60 + start.m;
  const endMin = end.h * 60 + end.m;
  const nowMin = now.h * 60 + now.m;
  const available = nowMin >= startMin && nowMin < endMin;

  const tzLabel = TZ_SHORT[tz] ?? tz;
  const startLabel = fmt12(start.h, start.m);
  const endLabel = fmt12(end.h, end.m);
  return {
    available,
    startLabel,
    endLabel,
    timezoneLabel: tzLabel,
    windowLabel: `${startLabel} – ${endLabel} ${tzLabel}`,
    nowLabel: fmt12(now.h, now.m),
  };
}

/** Build a WhatsApp click-to-chat URL for a coach phone (India defaults). */
export function whatsappCallUrl(phone: string, message?: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  // Assume India if no country code
  const withCc = digits.length === 10 ? `91${digits}` : digits;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${withCc}${text}`;
}

/**
 * Whether a scheduled meeting is currently "callable" — i.e. the "Call Now"
 * WhatsApp button should be shown. Window: 5 min before start → end of meeting.
 */
export function isMeetingCallable(scheduledAtIso: string, durationMin: number = 30): boolean {
  const start = new Date(scheduledAtIso).getTime();
  const now = Date.now();
  const open = start - 5 * 60 * 1000;
  const close = start + durationMin * 60 * 1000;
  return now >= open && now <= close;
}
