import { useEffect, useState } from "react";
import { Percent, Users, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface CommissionInfo {
  name: string;
  percent: number;
  payout_frequency: string;
  min_active_patients: number;
  min_avg_rating: number;
  active_patients: number;
  avg_rating: number;
}

export default function CoachCommissionCard() {
  const { user } = useAuth();
  const [info, setInfo] = useState<CommissionInfo | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: coach } = await supabase
        .from("coaches" as any)
        .select("id, commission_model_id, avg_rating")
        .eq("user_id", user.id)
        .maybeSingle();
      const c: any = coach;
      if (!c) return;

      const { count } = await supabase
        .from("coach_assignments" as any)
        .select("*", { count: "exact", head: true })
        .eq("coach_id", c.id)
        .eq("is_active", true);

      let model: any = null;
      if (c.commission_model_id) {
        const { data } = await supabase
          .from("commission_models" as any)
          .select("name, percent, payout_frequency, min_active_patients, min_avg_rating")
          .eq("id", c.commission_model_id)
          .maybeSingle();
        model = data;
      }
      if (!model) {
        const { data } = await supabase
          .from("commission_models" as any)
          .select("name, percent, payout_frequency, min_active_patients, min_avg_rating")
          .eq("is_default", true)
          .eq("is_active", true)
          .maybeSingle();
        model = data;
      }
      if (!model) return;

      setInfo({
        name: model.name,
        percent: Number(model.percent) || 0,
        payout_frequency: model.payout_frequency || "monthly",
        min_active_patients: Number(model.min_active_patients) || 0,
        min_avg_rating: Number(model.min_avg_rating) || 0,
        active_patients: count || 0,
        avg_rating: Number(c.avg_rating) || 0,
      });
    })();
  }, [user?.id]);

  if (!info) return null;

  return (
    <div className="liquid-glass rounded-2xl p-3 mb-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Percent className="w-3.5 h-3.5 text-primary" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-foreground font-bold text-xs truncate leading-tight">{info.name}</p>
            <p className="text-muted-foreground text-[9px] leading-tight capitalize">
              {info.payout_frequency} payout
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-sm leading-none text-primary">{info.percent}%</p>
          <p className="text-muted-foreground text-[8px] font-medium">commission</p>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Users className="w-3 h-3" strokeWidth={1.8} />
          <span className="font-semibold text-foreground">{info.active_patients}</span>
          <span>/ {info.min_active_patients} pts</span>
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Star className="w-3 h-3 text-amber-500" strokeWidth={1.8} />
          <span className="font-semibold text-foreground">{info.avg_rating.toFixed(1)}</span>
          <span>/ {info.min_avg_rating.toFixed(1)}</span>
        </span>
      </div>
    </div>
  );
}
