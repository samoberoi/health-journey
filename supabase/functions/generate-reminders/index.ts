const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const hour = now.getUTCHours() + 5.5; // IST offset
    const istHour = Math.floor(hour >= 24 ? hour - 24 : hour);
    const istMinute = now.getUTCMinutes();
    const todayIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().split("T")[0];
    const dayOfWeek = new Date(now.getTime() + 5.5 * 60 * 60 * 1000).getDay(); // 0=Sun, 1=Mon

    const results: string[] = [];

    // Helper: get user preferences (cached per invocation)
    const prefsCache = new Map<string, any>();
    async function getUserPrefs(userId: string) {
      if (prefsCache.has(userId)) return prefsCache.get(userId);
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      // Default all to true if no prefs row
      const prefs = data ?? {
        daily_log_reminders: true,
        weekly_weight_reminder: true,
        supplement_reminders: true,
        appointment_alerts: true,
        community_updates: true,
      };
      prefsCache.set(userId, prefs);
      return prefs;
    }

    // Patient habit nudges must never go to coaches/admins/partners, even if they also have a profile.
    const patientRecipientCache = new Map<string, boolean>();
    async function isPatientRecipient(userId: string): Promise<boolean> {
      if (patientRecipientCache.has(userId)) return patientRecipientCache.get(userId)!;
      const { data } = await supabase.rpc("is_patient_notification_recipient", { _user_id: userId });
      const allowed = data === true;
      patientRecipientCache.set(userId, allowed);
      return allowed;
    }

    // Helper: check if notification already sent today
    async function alreadySent(userId: string, type: string, titlePattern: string): Promise<boolean> {
      const { data } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", type)
        .gte("created_at", `${todayIST}T00:00:00`)
        .ilike("title", `%${titlePattern}%`)
        .limit(1);
      return (data?.length ?? 0) > 0;
    }

    // ─── 1. Supplement reminders (timing-aware) ───
    // Check supplement items with specific timing keywords
    const timingSlots: Record<string, { hours: number[]; keywords: string[] }> = {
      "Before Breakfast": { hours: [7], keywords: ["before breakfast", "empty stomach"] },
      "After Breakfast": { hours: [9], keywords: ["after breakfast", "with breakfast"] },
      "Before Lunch": { hours: [12], keywords: ["before lunch"] },
      "After Lunch": { hours: [14], keywords: ["after lunch", "with lunch", "with meal"] },
      "Before Dinner": { hours: [19], keywords: ["before dinner"] },
      "After Dinner": { hours: [21], keywords: ["after dinner", "with dinner"] },
      "Morning": { hours: [8], keywords: ["morning"] },
      "Evening": { hours: [19], keywords: ["evening", "night"] },
    };

    for (const [slotName, slot] of Object.entries(timingSlots)) {
      if (!slot.hours.includes(istHour)) continue;

      const { data: plans } = await supabase
        .from("user_supplement_plans")
        .select("id, user_id, plan_name")
        .eq("status", "active");

      if (plans) {
        for (const plan of plans) {
          if (!(await isPatientRecipient(plan.user_id))) continue;
          const prefs = await getUserPrefs(plan.user_id);
          if (!prefs.supplement_reminders) continue;

          // Find items matching this timing slot
          let matchingItems: any[] = [];
          for (const keyword of slot.keywords) {
            const { data: items } = await supabase
              .from("user_supplement_plan_items")
              .select("id, supplement_id")
              .eq("plan_id", plan.id)
              .eq("is_active", true)
              .ilike("timing", `%${keyword}%`);
            if (items) matchingItems.push(...items);
          }
          // Deduplicate
          const seen = new Set<string>();
          matchingItems = matchingItems.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });

          if (matchingItems.length === 0) continue;

          // Check if already taken today
          const { data: taken } = await supabase
            .from("user_supplement_tracking")
            .select("id")
            .eq("user_id", plan.user_id)
            .eq("date", todayIST)
            .eq("taken", true)
            .in("plan_item_id", matchingItems.map((i: any) => i.id));

          const untaken = matchingItems.length - (taken?.length ?? 0);
          if (untaken > 0 && !(await alreadySent(plan.user_id, "supplement_reminder", slotName))) {
            // Get supplement names
            const suppIds = matchingItems.map((i: any) => i.supplement_id);
            const { data: supps } = await supabase
              .from("supplement_master")
              .select("name")
              .in("id", suppIds);
            const names = supps?.map((s: any) => s.name).join(", ") ?? "supplements";

            await supabase.from("notifications").insert({
              user_id: plan.user_id,
              title: `💊 ${slotName} – Take Your Supplements`,
              body: `${names} (${untaken} pending). Don't miss your dose!`,
              type: "supplement_reminder",
              icon: "💊",
            });
            results.push(`supp_${slotName}:${plan.user_id}`);
          }
        }
      }
    }

    // ─── 2. Fasting reminders (FMOD at 7am, LMOD at 6pm IST) ───
    if (istHour === 7 || istHour === 18) {
      const { data: protocols } = await supabase
        .from("user_protocols")
        .select("user_id, protocol_id")
        .eq("status", "active");

      if (protocols) {
        for (const proto of protocols) {
          if (!(await isPatientRecipient(proto.user_id))) continue;
          const prefs = await getUserPrefs(proto.user_id);
          if (!prefs.daily_log_reminders) continue;

          const { data: tracked } = await supabase
            .from("fasting_tracking")
            .select("id, fmod_actual_time, lmod_actual_time")
            .eq("user_id", proto.user_id)
            .eq("date", todayIST)
            .limit(1)
            .maybeSingle();

          if (istHour === 7 && (!tracked || !tracked.fmod_actual_time)) {
            if (!(await alreadySent(proto.user_id, "fasting_reminder", "First Meal"))) {
              await supabase.from("notifications").insert({
                user_id: proto.user_id,
                title: "🍽️ Time for First Meal (FMOD)",
                body: "Log your first meal to start today's fasting timer. Capture a photo for calorie tracking!",
                type: "fasting_reminder",
                icon: "🍽️",
              });
              results.push(`fmod_reminder:${proto.user_id}`);
            }
          }

          if (istHour === 18 && tracked && tracked.fmod_actual_time && !tracked.lmod_actual_time) {
            if (!(await alreadySent(proto.user_id, "fasting_reminder", "Last Meal"))) {
              await supabase.from("notifications").insert({
                user_id: proto.user_id,
                title: "⏰ Last Meal Reminder (LMOD)",
                body: "It's almost time for your last meal. Log it before your fasting window begins!",
                type: "fasting_reminder",
                icon: "⏰",
              });
              results.push(`lmod_reminder:${proto.user_id}`);
            }
          }
        }
      }
    }

    // ─── 3. Water reminders (every 2 hours 9am-7pm IST) ───
    if (istHour >= 9 && istHour <= 19 && istHour % 2 === 1) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("onboarding_completed", true);

      if (profiles) {
        for (const p of profiles) {
          if (!(await isPatientRecipient(p.user_id))) continue;
          const prefs = await getUserPrefs(p.user_id);
          if (!prefs.daily_log_reminders) continue;

          const { data: waterLogs } = await supabase
            .from("health_logs")
            .select("weight_kg")
            .eq("user_id", p.user_id)
            .eq("log_type", "water")
            .gte("logged_at", `${todayIST}T00:00:00`);

          const totalGlasses = (waterLogs ?? []).reduce((s: number, l: any) => s + (l.weight_kg ?? 0), 0);
          if (totalGlasses < 8 && !(await alreadySent(p.user_id, "water_reminder", "Hydrated"))) {
            await supabase.from("notifications").insert({
              user_id: p.user_id,
              title: "💧 Stay Hydrated!",
              body: `You've logged ${totalGlasses}/8 glasses today. Keep drinking water!`,
              type: "water_reminder",
              icon: "💧",
            });
            results.push(`water_reminder:${p.user_id}`);
          }
        }
      }
    }

    // ─── 4. Daily Log Reminders: Diabetes + BP (8am and 8pm IST) ───
    if (istHour === 8 || istHour === 20) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, clinical, deep_profiling")
        .eq("onboarding_completed", true);

      if (profiles) {
        for (const p of profiles) {
          if (!(await isPatientRecipient(p.user_id))) continue;
          const prefs = await getUserPrefs(p.user_id);
          if (!prefs.daily_log_reminders) continue;

          const session = istHour === 8 ? "morning" : "evening";

          // --- Diabetes reminder ---
          const clinical = p.clinical as any;
          if (clinical?.hasDiabetes) {
            const glucoseField = istHour === 8 ? "glucose_morning" : "glucose_evening";
            const { data: logged } = await supabase
              .from("health_logs")
              .select("id")
              .eq("user_id", p.user_id)
              .eq("log_type", "diabetes")
              .gte("logged_at", `${todayIST}T00:00:00`)
              .not(glucoseField, "is", null)
              .limit(1);

            if ((!logged || logged.length === 0) && !(await alreadySent(p.user_id, "habit_reminder", `${session} Glucose`))) {
              await supabase.from("notifications").insert({
                user_id: p.user_id,
                title: `🩸 Log ${session.charAt(0).toUpperCase() + session.slice(1)} Glucose`,
                body: `Time to check and log your ${session} blood glucose reading.`,
                type: "habit_reminder",
                icon: "🩸",
              });
              results.push(`glucose_${session}:${p.user_id}`);
            }
          }

          // --- BP reminder ---
          // Only send BP reminders when the profile indicates hypertension or BP medicine.
          // Users who answered "No" for both should not receive BP tracking prompts.
          const deepProfiling = p.deep_profiling as any;
          const hasHypertension = clinical?.hasHypertension === true || clinical?.hasHypertension === "yes";
          const onBpMedicine = deepProfiling?.bpMedication === true || deepProfiling?.bpMedication === "yes";
          const needsBpTracking = hasHypertension || onBpMedicine;
          if (needsBpTracking) {
            const { data: bpLogged } = await supabase
              .from("health_logs")
              .select("id")
              .eq("user_id", p.user_id)
              .eq("log_type", "bp")
              .gte("logged_at", `${todayIST}T00:00:00`)
              .limit(1);

            if ((!bpLogged || bpLogged.length === 0) && !(await alreadySent(p.user_id, "habit_reminder", `${session} BP`))) {
              await supabase.from("notifications").insert({
                user_id: p.user_id,
                title: `❤️ Log ${session.charAt(0).toUpperCase() + session.slice(1)} BP`,
                body: `Don't forget to log your ${session} blood pressure reading.`,
                type: "habit_reminder",
                icon: "❤️",
              });
              results.push(`bp_${session}:${p.user_id}`);
            }
          }
        }
      }
    }

    // ─── 5. Weekly Weight Reminder (Monday 8am IST) ───
    if (dayOfWeek === 1 && istHour === 8) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("onboarding_completed", true);

      if (profiles) {
        for (const p of profiles) {
          if (!(await isPatientRecipient(p.user_id))) continue;
          const prefs = await getUserPrefs(p.user_id);
          if (!prefs.weekly_weight_reminder) continue;

          if (!(await alreadySent(p.user_id, "habit_reminder", "Weekly Weight"))) {
            await supabase.from("notifications").insert({
              user_id: p.user_id,
              title: "⚖️ Weekly Weight Check",
              body: "It's Monday! Time to log your weekly weight and track your progress.",
              type: "habit_reminder",
              icon: "⚖️",
            });
            results.push(`weight_weekly:${p.user_id}`);
          }
        }
      }
    }

    // ─── 6. Walk / Exercise reminder (10am IST daily) ───
    if (istHour === 10) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("onboarding_completed", true);

      if (profiles) {
        for (const p of profiles) {
          if (!(await isPatientRecipient(p.user_id))) continue;
          const prefs = await getUserPrefs(p.user_id);
          if (!prefs.daily_log_reminders) continue;

          if (!(await alreadySent(p.user_id, "habit_reminder", "Walk"))) {
            await supabase.from("notifications").insert({
              user_id: p.user_id,
              title: "🚶 Time for a Walk",
              body: "A 30-minute walk after meals helps manage blood sugar. Get moving!",
              type: "habit_reminder",
              icon: "🚶",
            });
            results.push(`walk_reminder:${p.user_id}`);
          }
        }
      }
    }

    // ─── 7. Coach alerts: health score declines ───
    {
      const { data: alerts } = await supabase
        .from("health_score_alerts")
        .select("id, coach_id, user_id, previous_score, new_score, score_delta")
        .eq("acknowledged", false);

      if (alerts) {
        for (const alert of alerts) {
          const { data: coach } = await supabase
            .from("coaches")
            .select("user_id, name")
            .eq("id", alert.coach_id)
            .single();

          if (coach?.user_id) {
            const { data: patient } = await supabase
              .from("profiles")
              .select("name")
              .eq("user_id", alert.user_id)
              .single();

            const patientName = patient?.name ?? "A patient";

            if (!(await alreadySent(coach.user_id, "coach_alert", alert.id))) {
              await supabase.from("notifications").insert({
                user_id: coach.user_id,
                title: `⚠️ ${patientName}'s Health Score Dropped`,
                body: `Score changed from ${alert.previous_score} → ${alert.new_score} (${alert.score_delta > 0 ? "+" : ""}${alert.score_delta}). Ref:${alert.id}`,
                type: "coach_alert",
                icon: "⚠️",
              });
              results.push(`coach_alert:${coach.user_id}`);

              await supabase
                .from("health_score_alerts")
                .update({ acknowledged: true })
                .eq("id", alert.id);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent: results.length, details: results, ist_hour: istHour, day: dayOfWeek }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-reminders error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
