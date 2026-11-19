"use client";

import { CircleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { resolveHelp } from "@/app/(app)/board/actions";
import { secondaryButtonClass } from "@/components/common/buttons";
import type { OpenHelp } from "@/lib/board/server";

const strongButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-field bg-help-strong px-4 text-[14px] font-bold whitespace-nowrap text-white transition-colors duration-150 outline-none hover:bg-help-strong/90 focus-visible:ring-3 focus-visible:ring-help-strong/30 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

/**
 * カードの困りごとの箱（赤系）。未解決の困りごとを1件ずつ出し、「手を貸す」で解決済みにする。
 * 解決者は押した人。自分の困りごとには「解決した」と出す。
 */
export function HelpBox({ helps, isMe, onResolved }: { helps: OpenHelp[]; isMe: boolean; onResolved: () => void }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resolve(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await resolveHelp(id);
      setConfirming(null);
      if (r.ok) onResolved();
      else if (r.error) setError(r.error);
    });
  }

  return (
    <section aria-label={`困りごと ${helps.length}件`} className="space-y-3 rounded-2xl bg-help-bg px-4 py-3">
      {helps.map((h) => (
        <div key={h.id} className="space-y-2">
          <div className="flex gap-2.5">
            <CircleAlert aria-hidden="true" strokeWidth={2} className="mt-0.5 size-5 shrink-0 text-help-strong" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium break-words whitespace-pre-wrap text-help-body">{h.body}</p>
              <p className="mt-0.5 text-[12px] text-help-ink">
                {h.taskName} · {h.createdLabel}
              </p>
            </div>
          </div>
          {confirming === h.id ? (
            <div role="group" aria-label="解決の確認" className="space-y-2 rounded-field bg-surface p-3">
              <p className="text-[13px] text-ink">
                {isMe ? "解決済みにしますか？" : "解決済みにしますか？あなたが解決した人として記録されます。"}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={strongButtonClass}
                  aria-disabled={pending || undefined}
                  onClick={() => !pending && resolve(h.id)}
                >
                  {pending ? "記録中…" : "解決済みにする"}
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setConfirming(null)}>
                  やめる
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button type="button" className={strongButtonClass} onClick={() => setConfirming(h.id)}>
                {isMe ? "解決した" : "手を貸す"}
              </button>
            </div>
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="text-[13px] font-bold text-help-ink">
          {error}
        </p>
      )}
    </section>
  );
}
