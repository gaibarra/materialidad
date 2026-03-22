"use client";

import Link from "next/link";
import { cn } from "../lib/utils";
import { type ReactNode } from "react";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("surface-panel flex flex-col items-center justify-center rounded-[28px] border-[rgba(25,36,52,0.08)] p-10 text-center", className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(143,240,224,0.18)] bg-[rgba(142,231,218,0.10)] text-[var(--fiscal-gold)]">
        {icon}
      </div>
      <p className="kicker-label">Sin elementos disponibles</p>
      <h3 className="mt-2 font-display text-lg font-semibold tracking-tight text-[var(--fiscal-ink)]">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="button-institutional mt-5 inline-flex items-center gap-2"
        >
          {action.label}
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
