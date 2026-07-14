import type { SVGProps } from "react";

const P = (d: string, filled?: boolean) => (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d={d} />
  </svg>
);

// Simple filled/outline dual-set. Using single-path glyphs.
export const TabHome = (props: SVGProps<SVGSVGElement> & { filled?: boolean }) => {
  const { filled, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5Z" />
    </svg>
  );
};

export const TabDiet = (props: SVGProps<SVGSVGElement> & { filled?: boolean }) => {
  const { filled, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 5v8l5 3" />
    </svg>
  );
};

export const TabMove = (props: SVGProps<SVGSVGElement> & { filled?: boolean }) => {
  const { filled, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d="M8 3v7l-3 5 4 6M16 3v7l3 5-4 6" />
    </svg>
  );
};

export const TabExercise = (props: SVGProps<SVGSVGElement> & { filled?: boolean }) => {
  const { filled, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" />
    </svg>
  );
};

export const TabFasting = (props: SVGProps<SVGSVGElement> & { filled?: boolean }) => {
  const { filled, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 8v5l3 2M9 3h6" />
    </svg>
  );
};

export const TabSupplements = (props: SVGProps<SVGSVGElement> & { filled?: boolean }) => {
  const { filled, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <path d="M12 8v8" />
    </svg>
  );
};

export const TabLabs = (props: SVGProps<SVGSVGElement> & { filled?: boolean }) => {
  const { filled, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d="M9 3h6v5l4 10a3 3 0 0 1-3 4H8a3 3 0 0 1-3-4l4-10V3Z" />
    </svg>
  );
};

export const TabVideos = (props: SVGProps<SVGSVGElement> & { filled?: boolean }) => {
  const { filled, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m10 9 5 3-5 3V9Z" fill={filled ? "white" : "currentColor"} />
    </svg>
  );
};

export const TabCommunity = (props: SVGProps<SVGSVGElement> & { filled?: boolean }) => {
  const { filled, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M3 20c0-3 3-5 6-5s6 2 6 5M14 20c0-2 2-4 4.5-4S23 18 23 20" />
    </svg>
  );
};

export const TabConsult = (props: SVGProps<SVGSVGElement> & { filled?: boolean }) => {
  const { filled, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v3a4 4 0 0 0 8 0v-2" />
      <circle cx="18" cy="12" r="2" />
    </svg>
  );
};
