import type { ReactNode } from "react";

export function EmptyState({
  image,
  title,
  description,
  action,
}: {
  image: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/60 px-6 py-12 text-center animate-fade-up">
      <img src={image} alt="" aria-hidden className="size-28 opacity-95" loading="lazy" />
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
