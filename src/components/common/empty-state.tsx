import type { ReactNode } from "react";

/** 0件のときの点線枠の箱（SCREENS.md §6） */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-border-strong px-6 py-10 text-center text-[14px] text-ink-2">
      <div>{children}</div>
      {action}
    </div>
  );
}
