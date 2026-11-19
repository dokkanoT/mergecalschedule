"use client";

import { useState, useTransition } from "react";
import type { MemberChangeResult } from "./actions";

type Props = {
  memberName: string;
  action: () => Promise<MemberChangeResult>;
};

/** メンバーを外す。押すとその場で確認を出し、もう一度押すと外す */
export function RemoveMemberButton({ memberName, action }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const smallButton =
    "min-h-9 rounded-field border px-3 text-[13px] font-medium disabled:text-muted-foreground";

  return (
    <div className="flex flex-col items-end gap-1">
      {confirming ? (
        <div role="group" aria-label={`${memberName} を外すか確認`} className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-[12px] text-help-body">{memberName} を外しますか？</span>
          <button
            type="button"
            disabled={pending}
            className={`${smallButton} border-help-strong bg-help-strong text-white hover:bg-help-strong/90`}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await action();
                if (result.error) setError(result.error);
                setConfirming(false);
              });
            }}
          >
            {pending ? "外しています…" : "外す"}
          </button>
          <button
            type="button"
            disabled={pending}
            className={`${smallButton} border-border-strong bg-surface text-ink hover:bg-background`}
            onClick={() => setConfirming(false)}
            autoFocus
          >
            やめる
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`${memberName} をプロジェクトから外す`}
          className={`${smallButton} border-border-strong bg-surface text-help-strong hover:bg-help-bg`}
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          外す
        </button>
      )}
      {error && (
        <p role="alert" className="max-w-72 text-right text-[12px] font-medium text-help-ink">
          {error}
        </p>
      )}
    </div>
  );
}
