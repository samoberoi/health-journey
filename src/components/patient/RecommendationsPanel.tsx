import { useEffect, useState } from "react";
import { FlaskConical, Pill, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTestRecsForUser, fetchSupplementRecsForUser, type TestRecommendation, type SupplementRecommendation } from "@/lib/recommendationService";
import { useNavigate } from "react-router-dom";

export default function RecommendationsPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestRecommendation[]>([]);
  const [supps, setSupps] = useState<SupplementRecommendation[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchTestRecsForUser(user.id).then(setTests);
    fetchSupplementRecsForUser(user.id).then(setSupps);
  }, [user]);

  if (tests.length === 0 && supps.length === 0) return null;

  return (
    <div className="liquid-glass rounded-3xl p-5 space-y-4">
      <p className="text-foreground font-bold text-sm">Coach recommendations</p>

      {tests.length > 0 && (
        <button onClick={() => navigate("/home?tab=labtests")} className="w-full rounded-2xl bg-primary/5 border border-primary/10 p-3 text-left hover:bg-primary/10 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <FlaskConical className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-bold text-sm">Lab tests recommended</p>
                <p className="text-xs text-muted-foreground">{tests[0].product_codes.length} test{tests[0].product_codes.length === 1 ? "" : "s"} — tap to order</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          {tests[0].note && <p className="text-xs text-muted-foreground mt-2 italic">"{tests[0].note}"</p>}
        </button>
      )}

      {supps.length > 0 && (
        <button onClick={() => navigate("/home?tab=habits")} className="w-full rounded-2xl bg-primary/5 border border-primary/10 p-3 text-left hover:bg-primary/10 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <Pill className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-bold text-sm">Supplements recommended</p>
                <p className="text-xs text-muted-foreground">{supps[0].items.length} item{supps[0].items.length === 1 ? "" : "s"}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          {supps[0].items.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {supps[0].items.slice(0, 6).map((it, i) => (
                <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-background text-foreground border border-border">
                  {it.name ?? "supplement"} {it.dose ? `• ${it.dose}` : ""}
                </span>
              ))}
            </div>
          )}
        </button>
      )}
    </div>
  );
}
