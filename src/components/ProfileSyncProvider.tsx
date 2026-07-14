import { useProfileSync } from "@/hooks/useProfileSync";
import { useVideoProgressSync } from "@/hooks/useVideoProgressSync";
import type { ReactNode } from "react";

export function ProfileSyncProvider({ children }: { children: ReactNode }) {
  useProfileSync();
  useVideoProgressSync();
  return <>{children}</>;
}
