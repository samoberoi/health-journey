import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * Standard section container. Consistent radius, padding, shadow.
 */
export function SectionCard({ title, action, children, className, bodyClassName }: Props) {
  return (
    <section className={cn("bbdo-surface-card p-5", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between mb-4">
          {title && <h2 className="bbdo-h2 text-lg text-foreground">{title}</h2>}
          {action && <div className="flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/**
 * Nested/quiet card inside a SectionCard.
 */
export function SubCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("bbdo-surface-sub p-4", className)}>{children}</div>;
}

export default SectionCard;
