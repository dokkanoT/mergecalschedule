import { CircleAlert, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  tone: "error" | "warn";
  title: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** ルール違反・エラーの表示。error は保存不可（赤系）、warn は警告（オレンジ系） */
export function RuleAlert({ tone, title, children, className }: Props) {
  const Icon = tone === "error" ? CircleAlert : TriangleAlert;
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-2xl px-4 py-3 text-[14px]",
        tone === "error" ? "bg-help-bg text-help-body" : "bg-late-bg text-late-ink",
        className,
      )}
    >
      <Icon aria-hidden="true" strokeWidth={2} className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 space-y-1">
        <p className={cn("font-bold", tone === "error" ? "text-help-ink" : "text-late-ink")}>{title}</p>
        {children}
      </div>
    </div>
  );
}
