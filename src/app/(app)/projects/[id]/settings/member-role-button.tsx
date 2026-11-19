"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ProjectRole } from "@/lib/invitations";
import type { MemberChangeResult } from "./actions";

type Props = {
  memberName: string;
  currentRole: ProjectRole;
  isSelf: boolean;
  action: (role: ProjectRole) => Promise<MemberChangeResult>;
};

/** 役割の切り替え（オーナー ⇄ メンバー） */
export function MemberRoleButton({ memberName, currentRole, isSelf, action }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next: ProjectRole = currentRole === "owner" ? "member" : "owner";
  const label = next === "owner" ? "オーナーにする" : "メンバーにする";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        aria-label={`${memberName} を${label}`}
        className="min-h-9 rounded-field border border-border-strong bg-surface px-3 text-[13px] font-medium text-ink hover:bg-background disabled:text-muted-foreground"
        onClick={() => {
          if (isSelf && next === "member" && !confirm("自分をメンバーにすると、このプロジェクトの設定を変えられなくなります。よろしいですか？")) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await action(next);
            if (result.error) {
              setError(result.error);
              return;
            }
            if (isSelf && next === "member") router.push("/projects");
          });
        }}
      >
        {pending ? "変更中…" : label}
      </button>
      {error && (
        <p role="alert" className="max-w-64 text-right text-[12px] font-medium text-help-ink">
          {error}
        </p>
      )}
    </div>
  );
}
