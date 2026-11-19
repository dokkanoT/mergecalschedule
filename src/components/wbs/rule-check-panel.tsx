import { Check } from "lucide-react";
import type { RuleCheckItem } from "@/lib/wbs";
import { cn } from "@/lib/utils";

/** ルールチェック欄（SCREENS.md §5-3）。OK は青い丸にチェック、NG はオレンジの丸に「!」 */
export function RuleCheckPanel({ items }: { items: RuleCheckItem[] }) {
  return (
    <section aria-labelledby="rule-check" className="space-y-4 rounded-card border border-border bg-surface p-5">
      <h2 id="rule-check" className="text-[16px] font-bold text-ink">
        ルールチェック
      </h2>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.key} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                item.ok ? "bg-ok-bg text-ok-ink" : "bg-late-bg text-late-ink",
              )}
            >
              {item.ok ? <Check aria-hidden="true" strokeWidth={3} className="size-3.5" /> : <span aria-hidden="true">!</span>}
              <span className="sr-only">{item.ok ? "OK" : "要確認"}</span>
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-ink">{item.title}</p>
              <p className="text-[12px] text-ink-2">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
