"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="min-h-9 shrink-0 rounded-field border border-border-strong bg-surface px-3 text-[13px] font-medium text-ink hover:bg-background"
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      ログアウト
    </button>
  );
}
