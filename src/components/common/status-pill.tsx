import { cn } from "@/lib/utils";

export type StatusKind = "ok" | "late" | "help" | "free";

const STYLES: Record<StatusKind, string> = {
  ok: "bg-ok-bg text-ok-ink",
  late: "bg-late-bg text-late-ink",
  help: "bg-help-bg text-help-ink",
  free: "bg-free-bg text-free-ink",
};

const LABELS: Record<StatusKind, string> = { ok: "順調", late: "遅れ", help: "困りごとあり", free: "空き" };

/** 状態のピル。色だけでなく必ず文字を添える（SCREENS.md §4） */
export function StatusPill({ status, label, className }: { status: StatusKind; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold", STYLES[status], className)}>
      {label ?? LABELS[status]}
    </span>
  );
}
