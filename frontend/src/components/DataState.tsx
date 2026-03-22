import { type ReactNode } from "react";

import { cn } from "../lib/utils";
import { EmptyState } from "./EmptyState";

type InlineEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  className?: string;
};

export function InlineEmptyState({ icon, title, description, className }: InlineEmptyStateProps) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      className={cn("rounded-[24px] p-6 sm:p-8", className)}
    />
  );
}

type DataCardsSkeletonProps = {
  cards?: number;
  className?: string;
};

export function DataCardsSkeleton({ cards = 3, className }: DataCardsSkeletonProps) {
  return (
    <div className={cn("grid gap-3 md:grid-cols-2", className)} aria-hidden="true">
      {Array.from({ length: cards }).map((_, index) => (
        <article
          key={index}
          className="animate-pulse rounded-[1.5rem] border border-[rgba(200,192,177,0.72)] bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="h-3 w-20 rounded-full bg-[rgba(200,192,177,0.45)]" />
              <div className="h-5 w-40 rounded-full bg-[rgba(25,36,52,0.08)]" />
            </div>
            <div className="h-7 w-20 rounded-full bg-[rgba(142,231,218,0.16)]" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[rgba(244,242,237,0.55)] p-3">
              <div className="h-3 w-24 rounded-full bg-[rgba(200,192,177,0.45)]" />
              <div className="mt-2 h-4 w-full rounded-full bg-[rgba(25,36,52,0.08)]" />
              <div className="mt-2 h-4 w-3/4 rounded-full bg-[rgba(25,36,52,0.08)]" />
            </div>
            <div className="rounded-2xl bg-[rgba(244,242,237,0.55)] p-3">
              <div className="h-3 w-20 rounded-full bg-[rgba(200,192,177,0.45)]" />
              <div className="mt-2 h-4 w-full rounded-full bg-[rgba(25,36,52,0.08)]" />
              <div className="mt-2 h-4 w-2/3 rounded-full bg-[rgba(25,36,52,0.08)]" />
            </div>
          </div>
          <div className="mt-4 h-10 rounded-2xl bg-[rgba(25,36,52,0.06)]" />
        </article>
      ))}
    </div>
  );
}