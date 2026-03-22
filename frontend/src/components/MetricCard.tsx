"use client";

import Link from "next/link";
import { cn } from "../lib/utils";

/* ── Sparkline SVG (pure, no external lib) ── */
export function SparklineSVG({
  data,
  color = "#6366f1",
  width = 80,
  height = 28,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const h = height - padding * 2;
  const w = width - padding * 2;

  const points = data.map((v, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * w;
    const y = padding + h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p}`).join(" ");

  // Area fill
  const areaD = `${pathD} L${(padding + w).toFixed(1)},${(padding + h).toFixed(1)} L${padding},${(padding + h).toFixed(1)} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <path d={areaD} fill={color} opacity={0.1} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Tone config ── */
export type MetricTone = "positive" | "warning" | "alert" | "info";

const TONE_CLASSES: Record<MetricTone, { ring: string; text: string; badge: string; sparkColor: string }> = {
  positive: {
    ring: "border-[rgba(31,122,90,0.24)] hover:border-[rgba(31,122,90,0.45)]",
    text: "text-[var(--fiscal-success)]",
    badge: "bg-[var(--fiscal-success-soft)] text-[var(--fiscal-success)]",
    sparkColor: "#1f7a5a",
  },
  warning: {
    ring: "border-[rgba(166,103,31,0.24)] hover:border-[rgba(166,103,31,0.45)]",
    text: "text-[var(--fiscal-warning)]",
    badge: "bg-[var(--fiscal-warning-soft)] text-[var(--fiscal-warning)]",
    sparkColor: "#a6671f",
  },
  alert: {
    ring: "border-[rgba(160,67,61,0.24)] hover:border-[rgba(160,67,61,0.45)]",
    text: "text-[var(--fiscal-danger)]",
    badge: "bg-[var(--fiscal-danger-soft)] text-[var(--fiscal-danger)]",
    sparkColor: "#a0433d",
  },
  info: {
    ring: "border-[rgba(45,91,136,0.18)] hover:border-[rgba(45,91,136,0.35)]",
    text: "text-[var(--fiscal-accent)]",
    badge: "bg-[var(--fiscal-accent-soft)] text-[var(--fiscal-accent)]",
    sparkColor: "#2d5b88",
  },
};

/* ── MetricCard ── */
export interface MetricCardProps {
  title: string;
  value: string;
  helper?: string;
  tone?: MetricTone;
  href?: string;
  sparklineData?: number[];
  trend?: string; // e.g. "+12.3%" or "-5pp"
  className?: string;
}

export function MetricCard({
  title,
  value,
  helper,
  tone = "info",
  href,
  sparklineData,
  trend,
  className,
}: MetricCardProps) {
  const t = TONE_CLASSES[tone];

  const inner = (
    <div
      className={cn(
        "surface-panel rounded-[1.6rem] border p-5 transition-all hover:-translate-y-0.5 hover:shadow-fiscal",
        t.ring,
        href && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fiscal-muted)]">{title}</p>
        {sparklineData && sparklineData.length > 1 && (
          <SparklineSVG data={sparklineData} color={t.sparkColor} />
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <p className={cn("font-display text-3xl font-semibold tracking-tight", t.text)}>{value}</p>
        {trend && (
          <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]", t.badge)}>
            {trend}
          </span>
        )}
      </div>

      {helper && <p className="mt-1.5 text-xs leading-relaxed text-[var(--fiscal-muted)]">{helper}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-panel outline-none focus-visible:ring-2 focus-visible:ring-[var(--fiscal-accent)]/40">
        {inner}
      </Link>
    );
  }

  return inner;
}
