import { useEffect, useState, useCallback } from "react";
import { fetchThumbnailOverrides, type ThumbnailMap } from "@/lib/videoThumbnailService";

export function useVideoThumbnails() {
  const [overrides, setOverrides] = useState<ThumbnailMap>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const map = await fetchThumbnailOverrides();
    setOverrides(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const resolve = useCallback(
    (videoId: string, fallback: string) => overrides[videoId] || fallback,
    [overrides],
  );

  return { overrides, loading, reload, resolve };
}
