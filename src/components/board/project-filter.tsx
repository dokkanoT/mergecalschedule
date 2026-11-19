"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { ProjectDot } from "@/components/common/project-tile";
import { cn } from "@/lib/utils";

/** すべて／プロジェクト別の切り替え（?project= に入れて読み直す）。選択中は黒塗り白字 */
export function ProjectFilter({
  projects,
  selected,
}: {
  projects: { id: string; name: string; color: string }[];
  selected: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const options = [{ id: null, name: "すべて", color: null }, ...projects];

  return (
    <div role="group" aria-label="プロジェクトで絞り込む" className="mb-6 flex flex-wrap gap-2" aria-busy={pending || undefined}>
      {options.map((o) => {
        const active = o.id === selected;
        return (
          <button
            key={o.id ?? "all"}
            type="button"
            aria-pressed={active}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[14px] font-bold transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-primary/30",
              active ? "border-ink bg-ink text-white" : "border-border-strong bg-surface text-ink-2 hover:bg-background",
            )}
            onClick={() =>
              startTransition(() => router.replace(o.id ? `${pathname}?project=${o.id}` : pathname, { scroll: false }))
            }
          >
            {o.color && <ProjectDot color={o.color} />}
            {o.name}
          </button>
        );
      })}
    </div>
  );
}
