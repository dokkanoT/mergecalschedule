"use client";

import { useState, useTransition } from "react";
import { inputClass } from "@/components/common/field";
import { primaryButtonClass, secondaryButtonClass } from "@/components/common/buttons";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  label: string;
  initial?: string;
  placeholder?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<{ error?: string }>;
  onDone: () => void;
};

/** 目的・フェーズの名前をその場で入力する小さなフォーム（追加・名前の変更） */
export function InlineNameForm({ id, label, initial = "", placeholder, submitLabel, onSubmit, onDone }: Props) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await onSubmit(name);
          if (r.error) setError(r.error);
          else onDone();
        });
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDone();
      }}
    >
      <div className="min-w-56 flex-1 space-y-1">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          id={id}
          className={cn(inputClass)}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && (
          <p id={`${id}-error`} className="text-[13px] font-medium text-help-ink">
            {error}
          </p>
        )}
      </div>
      <button type="submit" className={primaryButtonClass} disabled={pending}>
        {pending ? "保存中…" : submitLabel}
      </button>
      <button type="button" className={secondaryButtonClass} onClick={onDone}>
        やめる
      </button>
    </form>
  );
}
