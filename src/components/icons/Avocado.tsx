import { forwardRef, SVGProps } from "react";

interface AvocadoProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

// Lucide-compatible Avocado icon (outline style, currentColor)
const Avocado = forwardRef<SVGSVGElement, AvocadoProps>(
  ({ size = 24, strokeWidth = 2, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Outer avocado silhouette (pear shape) */}
      <path d="M12 2.5c-3.6 0-6.5 3.2-6.5 7.3 0 2 .7 3.6 1.7 5 1.4 2 3 4.7 3 6.2 0 .6.4 1 1 1h1.6c.6 0 1-.4 1-1 0-1.5 1.6-4.2 3-6.2 1-1.4 1.7-3 1.7-5 0-4.1-2.9-7.3-6.5-7.3Z" />
      {/* Pit */}
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  )
);
Avocado.displayName = "Avocado";

export default Avocado;
