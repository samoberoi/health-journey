import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import supplements from "@/assets/auth-carousel/supplements.png.asset.json";
import meditation from "@/assets/auth-carousel/meditation.png.asset.json";
import fasting from "@/assets/auth-carousel/fasting.png.asset.json";
import activity from "@/assets/auth-carousel/activity.png.asset.json";
import morningRitual from "@/assets/auth-carousel/morning-ritual.png.asset.json";
import { resolveAssetUrl } from "@/lib/assetUrl";

const SLIDES = [
  { url: resolveAssetUrl(fasting.url), alt: "Fasting window — lemon water and morning light" },
  { url: resolveAssetUrl(activity.url), alt: "Active walking outdoors" },
  { url: resolveAssetUrl(meditation.url), alt: "Morning meditation and calm" },
  { url: resolveAssetUrl(supplements.url), alt: "Daily supplement support" },
  { url: resolveAssetUrl(morningRitual.url), alt: "Morning ritual — lemon water, coffee and mindful start" },
];

// Eagerly warm the browser/CDN cache the moment this module is imported, so
// the first slide paints instantly and subsequent slides swap without a fetch.
const preloadedImages: HTMLImageElement[] = [];
if (typeof window !== "undefined") {
  SLIDES.forEach((s) => {
    const img = new Image();
    img.decoding = "async";
    // @ts-expect-error fetchpriority is valid in modern browsers
    img.fetchPriority = "high";
    img.src = s.url;
    preloadedImages.push(img);
  });
}

interface Props {
  alt?: string;
  intervalMs?: number;
}

export default function AuthHeroCarousel({ intervalMs = 4200 }: Props) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % SLIDES.length), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return (
    <>
      {/* Render every slide once so they're all decoded and ready — only the active one is visible. */}
      {SLIDES.map((s, idx) => (
        <img
          key={idx}
          src={s.url}
          alt={s.alt}
          loading="eager"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: idx === i ? 1 : 0, transition: "opacity 700ms ease-in-out", zIndex: idx === i ? 1 : 0 }}
        />
      ))}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-3 flex gap-1.5 z-10">
        {SLIDES.map((_, idx) => (
          <span
            key={idx}
            className={`h-1.5 rounded-full transition-all duration-500 ${idx === i ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
          />
        ))}
      </div>
    </>
  );
}
