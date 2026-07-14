import { useEffect, useState, useCallback } from "react";
import {
  loadWatched,
  loadDurations,
  type WatchRecord,
} from "@/lib/videoProgressStore";

export function useVideoProgress() {
  const [watched, setWatched] = useState<Record<string, WatchRecord>>(() => loadWatched());
  const [durations, setDurations] = useState<Record<string, number>>(() => loadDurations());

  useEffect(() => {
    const sync = () => {
      setWatched(loadWatched());
      setDurations(loadDurations());
    };
    window.addEventListener("bbdo:video-progress-changed", sync);
    window.addEventListener("bbdo:yt-durations-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("bbdo:video-progress-changed", sync);
      window.removeEventListener("bbdo:yt-durations-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const getStatus = useCallback(
    (videoId: string, youtubeId?: string) => {
      const w = watched[videoId];
      const dur = w?.durationSec || (youtubeId ? durations[youtubeId] : 0) || 0;
      const progress = w?.progressSec ?? 0;
      const ratio = dur > 0 ? Math.min(1, progress / dur) : 0;
      return {
        durationSec: dur,
        progressSec: progress,
        ratio,
        completed: !!w?.completed,
        started: !!w && progress > 5,
      };
    },
    [watched, durations],
  );

  return { watched, durations, getStatus };
}
