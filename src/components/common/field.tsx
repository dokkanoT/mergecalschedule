import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type FieldControlProps = {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

type Props = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  /** 入力部品。id・aria-invalid・aria-describedby を付けて描く */
  children: (control: FieldControlProps) => ReactNode;
};

/** ラベル＋入力＋補足＋エラー文（SCREENS.md §4 Field） */
export function Field({ id, label, hint, error, required, className, children }: Props) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[13px] font-bold text-ink-2">
        {label}
        {required && <span className="ml-1 text-[12px] font-medium text-muted-foreground">必須</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error && (
        <p id={errorId} className="text-[13px] font-medium text-help-ink">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-[12px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** 入力欄の見た目。エラー時は 2px の赤枠 */
export const inputClass =
  "h-11 w-full rounded-field border border-border-strong bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 aria-invalid:border-2 aria-invalid:border-error-ring disabled:bg-muted disabled:text-muted-foreground";
