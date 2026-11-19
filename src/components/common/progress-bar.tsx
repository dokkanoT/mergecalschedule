/** 進捗バー（高さ 6px、中身はプロジェクト色）。右に xx% */
export function ProgressBar({ pct, color, label }: { pct: number; color: string; label?: string }) {
  const value = Math.min(Math.max(pct, 0), 100);
  return (
    <div className="flex min-w-24 items-center gap-2">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={label ?? "進捗"}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-free-bg"
      >
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="w-9 text-right text-[12px] font-bold text-ink">{value}%</span>
    </div>
  );
}
