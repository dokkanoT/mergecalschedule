import { cn } from "@/lib/utils";

/** 円にイニシャル1文字。背景は tint（なければ空きの灰色） */
export function MemberAvatar({ name, tint, size = "md" }: { name: string; tint?: string | null; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-ink-2",
        size === "sm" ? "size-7 text-[12px]" : "size-10 text-[15px]",
      )}
      style={{ backgroundColor: tint ?? "#EDEEF1" }}
    >
      {name.slice(0, 1)}
    </span>
  );
}
