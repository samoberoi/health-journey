import { supabase } from "@/integrations/supabase/client";

export type ThumbnailMap = Record<string, string>;

export async function fetchThumbnailOverrides(): Promise<ThumbnailMap> {
  const { data, error } = await supabase
    .from("video_thumbnails")
    .select("video_id, thumbnail_url");
  if (error || !data) return {};
  const map: ThumbnailMap = {};
  for (const row of data) map[row.video_id] = row.thumbnail_url;
  return map;
}

export async function setVideoThumbnail(videoId: string, thumbnailUrl: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("video_thumbnails")
    .upsert({
      video_id: videoId,
      thumbnail_url: thumbnailUrl,
      updated_by: auth.user?.id ?? null,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export async function clearVideoThumbnail(videoId: string) {
  const { error } = await supabase.from("video_thumbnails").delete().eq("video_id", videoId);
  if (error) throw error;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
