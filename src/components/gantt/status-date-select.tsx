"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { inputClass } from "@/components/common/field";
import { cn } from "@/lib/utils";

/** 進捗管理日の切り替え（?date= に入れて読み直す） */
export function StatusDateSelect({
  value,
  options,
}: {
  value: string;
  options: { date: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="status-date" className="text-[13px] font-bold text-ink-2">
        進捗管理日
      </label>
      <select
        id="status-date"
        className={cn(inputClass, "w-auto min-w-52")}
        value={value}
        disabled={pending}
        onChange={(e) => startTransition(() => router.push(`${pathname}?date=${e.target.value}`))}
      >
        {options.map((o) => (
          <option key={o.date} value={o.date}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
