"use client";

import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex size-9 items-center justify-center rounded-field text-ink-2 outline-none hover:bg-background focus-visible:ring-3 focus-visible:ring-primary/30 disabled:text-border-strong disabled:hover:bg-transparent [&_svg]:size-4";

export function IconButton({ className, ...props }: ComponentProps<"button"> & { "aria-label": string }) {
  return <button type="button" className={cn(base, className)} {...props} />;
}

/** ↑↓（並べ替え）。先頭・末尾では押せない */
export function MoveButtons({
  label,
  isFirst,
  isLast,
  onMove,
  disabled,
}: {
  label: string;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: "up" | "down") => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex">
      <IconButton aria-label={`${label} を上へ`} disabled={disabled || isFirst} onClick={() => onMove("up")}>
        <ArrowUp aria-hidden="true" strokeWidth={2} />
      </IconButton>
      <IconButton aria-label={`${label} を下へ`} disabled={disabled || isLast} onClick={() => onMove("down")}>
        <ArrowDown aria-hidden="true" strokeWidth={2} />
      </IconButton>
    </span>
  );
}

export function EditIcon() {
  return <Pencil aria-hidden="true" strokeWidth={2} />;
}

export function DeleteIcon() {
  return <Trash2 aria-hidden="true" strokeWidth={2} />;
}
