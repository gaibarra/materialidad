"use client";

import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";

export interface SectionAccordionProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  /** Color variant for the icon badge & accent */
  color: "rose" | "blue" | "emerald" | "purple" | "amber";
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

const COLOR_MAP: Record<string, { accent: string; iconBg: string; iconText: string; badge: string }> = {
  rose: {
    accent: "text-[var(--fiscal-danger)]",
    iconBg: "bg-[var(--fiscal-danger-soft)]",
    iconText: "text-[var(--fiscal-danger)]",
    badge: "bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)]",
  },
  blue: {
    accent: "text-[var(--fiscal-accent)]",
    iconBg: "bg-[var(--fiscal-accent-soft)]",
    iconText: "text-[var(--fiscal-accent)]",
    badge: "bg-[var(--fiscal-accent-soft)] text-[var(--fiscal-accent)]",
  },
  emerald: {
    accent: "text-[var(--fiscal-success)]",
    iconBg: "bg-[var(--fiscal-success-soft)]",
    iconText: "text-[var(--fiscal-success)]",
    badge: "bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]",
  },
  purple: {
    accent: "text-[var(--fiscal-accent)]",
    iconBg: "bg-[rgba(45,91,136,0.08)]",
    iconText: "text-[var(--fiscal-accent)]",
    badge: "bg-[rgba(45,91,136,0.08)] text-[var(--fiscal-accent)]",
  },
  amber: {
    accent: "text-[var(--fiscal-warning)]",
    iconBg: "bg-[var(--fiscal-warning-soft)]",
    iconText: "text-[var(--fiscal-warning)]",
    badge: "bg-[var(--fiscal-warning-soft)] text-[var(--fiscal-warning)]",
  },
};

export function SectionAccordion({
  title,
  subtitle,
  icon,
  color,
  badge,
  defaultOpen = false,
  children,
}: SectionAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const c = COLOR_MAP[color];
  const panelId = `accordion-panel-${title.replace(/\s+/g, "-").toLowerCase()}`;
  const triggerId = `accordion-trigger-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <section className="surface-panel overflow-hidden rounded-[1.7rem]">
      <button
        id={triggerId}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-6 py-5 text-left transition-colors hover:bg-[rgba(255,255,255,0.42)]"
      >
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm", c.iconBg, c.iconText)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className={cn("font-display text-xl font-semibold tracking-tight", c.accent)}>
              {title}
            </h2>
            {badge && (
              <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]", c.badge)}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-[13px] text-[var(--fiscal-muted)] truncate">{subtitle}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-[var(--fiscal-muted)] transition-transform duration-300",
            open && "rotate-180"
          )}
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[rgba(200,192,177,0.6)] px-6 pb-6 pt-4">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
