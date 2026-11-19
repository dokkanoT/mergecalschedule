"use client";

import { useTransition } from "react";

export function RevokeInvitationButton({ email, action }: { email: string; action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`${email} への招待を取り消す`}
      className="min-h-9 rounded-field border border-border-strong bg-surface px-3 text-[13px] font-medium text-help-strong hover:bg-help-bg disabled:text-muted-foreground"
      onClick={() => startTransition(action)}
    >
      {pending ? "取り消し中…" : "取り消す"}
    </button>
  );
}
