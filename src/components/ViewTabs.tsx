"use client";

export type ViewId = "attack" | "defense" | "log";

export interface TabDef {
  id: ViewId;
  label: string;
  badge?: boolean; // show a pulsing alert dot
}

interface ViewTabsProps {
  tabs: TabDef[];
  active: ViewId;
  onChange: (id: ViewId) => void;
  /** Container class — `battle-tabs` (mobile-only) or `result-tabs` (always). */
  className: string;
  ariaLabel?: string;
}

/** Shared segmented control used by the battle and result screens. */
export default function ViewTabs({
  tabs,
  active,
  onChange,
  className,
  ariaLabel = "View",
}: ViewTabsProps) {
  return (
    <div className={className} role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={`battle-tab battle-tab--${t.id} ${active === t.id ? "battle-tab--active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.badge && <span className="tab-badge" aria-label="New" />}
        </button>
      ))}
    </div>
  );
}

/** Format a millisecond duration as `m:ss`. */
export function formatDuration(ms: number | null): string {
  if (!ms || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
