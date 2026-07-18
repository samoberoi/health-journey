export type YouTubePlayerMessage = {
  source: "bbdo-youtube-player";
  type: "ready" | "state" | "progress" | "error";
  videoId: string;
  state?: number;
  currentTime?: number;
  duration?: number;
  code?: number;
};

export function youtubePlayerProxyUrl(
  videoId: string,
  options: { autoplay?: boolean; start?: number; controls?: boolean; simple?: boolean } = {},
) {
  const params = new URLSearchParams({
    v: videoId,
    autoplay: options.autoplay === false ? "0" : "1",
    controls: options.controls === false ? "0" : "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    fs: "1",
  });

  if (options.simple) params.set("mode", "simple");

  const start = Math.max(0, Math.floor(options.start || 0));
  if (start > 0) params.set("start", String(start));

  return `/youtube-player.html?${params.toString()}`;
}

export function isYoutubePlayerMessage(data: unknown, videoId?: string): data is YouTubePlayerMessage {
  if (!data || typeof data !== "object") return false;
  const message = data as Partial<YouTubePlayerMessage>;
  if (message.source !== "bbdo-youtube-player") return false;
  if (!message.videoId || (videoId && message.videoId !== videoId)) return false;
  return ["ready", "state", "progress", "error"].includes(message.type || "");
}

export function isNativeMobileApp() {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  try {
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return Boolean(cap?.getPlatform && cap.getPlatform() !== "web");
  }
}

export function isNativeIOSApp() {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  try {
    return Boolean(cap?.isNativePlatform?.() && cap?.getPlatform?.() === "ios");
  } catch {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && isNativeMobileApp();
  }
}

export function isNativeAndroidApp() {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  try {
    return Boolean(cap?.isNativePlatform?.() && cap?.getPlatform?.() === "android");
  } catch {
    return /android/i.test(window.navigator.userAgent) && isNativeMobileApp();
  }
}

const NATIVE_VIDEO_SUPPRESS_KEY = "bbdo:native-video-suppress-until";

export function extendNativeVideoSuppression(minutes = 30) {
  if (typeof window === "undefined") return;
  const until = Date.now() + minutes * 60 * 1000;
  (window as any).__bbdoBiometricSuppressUntil = until;
  (window as any).__bbdoNativeVideoActive = true;
  try { window.localStorage.setItem(NATIVE_VIDEO_SUPPRESS_KEY, String(until)); } catch { /* ignore */ }
}

export function clearNativeVideoActive(keepSuppressedMinutes = 10) {
  if (typeof window === "undefined") return;
  (window as any).__bbdoNativeVideoActive = false;
  const until = Date.now() + keepSuppressedMinutes * 60 * 1000;
  (window as any).__bbdoBiometricSuppressUntil = until;
  try { window.localStorage.setItem(NATIVE_VIDEO_SUPPRESS_KEY, String(until)); } catch { /* ignore */ }
}

export function isNativeVideoPlaybackSuppressed() {
  if (typeof window === "undefined") return false;
  const memoryUntil = Number((window as any).__bbdoBiometricSuppressUntil || 0);
  let storedUntil = 0;
  try { storedUntil = Number(window.localStorage.getItem(NATIVE_VIDEO_SUPPRESS_KEY) || 0); } catch { /* ignore */ }
  return Boolean((window as any).__bbdoNativeVideoActive) || Date.now() < Math.max(memoryUntil, storedUntil);
}