/**
 * Smart clinical-condition inference from the user's most recent lab results.
 * Read-only: returns a diff of deep-profiling fields that the caller may merge
 * into the stored profile so the app reflects blood-test reality automatically.
 */
import type { LabResult } from "@/lib/labResultsService";

export interface InferredConditions {
  thyroid?: "yes" | "no";
  thyroidType?: "hypothyroid" | "hyperthyroid" | "unsure";
  uricAcid?: number;
  kidneyDisease?: "yes" | "no" | "unsure";
  ironDeficiency?: "yes" | "no";
  fattyLiver?: "yes";
}

function findLatest(results: LabResult[], codes: string[]): LabResult | undefined {
  const set = new Set(codes.map((c) => c.toUpperCase()));
  return results.find((r) => set.has((r.parameter_code || "").toUpperCase()));
}

/**
 * Given lab results (already sorted newest-first as returned by fetchUserResults),
 * derive high-signal condition flags. Only strong signals set values — soft signals
 * are omitted so we never overwrite a user's answer with a noisy hit.
 */
export function inferConditionsFromLabs(results: LabResult[]): InferredConditions {
  const out: InferredConditions = {};
  if (!results || results.length === 0) return out;

  const tsh = findLatest(results, ["TSH"]);
  const ft3 = findLatest(results, ["FT3", "T3F", "T3"]);
  const ft4 = findLatest(results, ["FT4", "T4F", "T4"]);

  const tshHigh = tsh?.status === "high";
  const tshLow = tsh?.status === "low";
  const t3High = ft3?.status === "high";
  const t3Low = ft3?.status === "low";
  const t4High = ft4?.status === "high";
  const t4Low = ft4?.status === "low";

  if (tshHigh || t4Low || t3Low) {
    out.thyroid = "yes";
    out.thyroidType = "hypothyroid";
  } else if (tshLow || t4High || t3High) {
    out.thyroid = "yes";
    out.thyroidType = "hyperthyroid";
  }

  const uric = findLatest(results, ["URIC", "URICACID", "UA"]);
  if (uric?.value_numeric != null) out.uricAcid = uric.value_numeric;

  const creat = findLatest(results, ["SCRE", "CREA", "CREAT"]);
  const bun = findLatest(results, ["BUN", "UREA"]);
  if (creat?.status === "high" || bun?.status === "high") {
    out.kidneyDisease = "yes";
  }

  const ferr = findLatest(results, ["FERR", "FERRITIN"]);
  const hb = findLatest(results, ["HB", "HGB", "HAEMOGLOBIN", "HEMOGLOBIN"]);
  if (ferr?.status === "low" || hb?.status === "low") {
    out.ironDeficiency = "yes";
  }

  const sgpt = findLatest(results, ["SGPT", "ALT"]);
  const sgot = findLatest(results, ["SGOT", "AST"]);
  const ggt = findLatest(results, ["GGT"]);
  if ((sgpt?.status === "high" ? 1 : 0) + (sgot?.status === "high" ? 1 : 0) + (ggt?.status === "high" ? 1 : 0) >= 2) {
    out.fattyLiver = "yes";
  }

  return out;
}
