"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { postHelp } from "@/app/(app)/board/actions";
import { primaryButtonClass, secondaryButtonClass } from "@/components/common/buttons";
import { Field, inputClass } from "@/components/common/field";
import type { LoadedBoardTask } from "@/lib/board/server";
import { formatPeriod } from "@/lib/format";
import { HELP_BODY_MAX, validateHelpBody } from "@/lib/rules";
import { cn } from "@/lib/utils";

/** 自分のカードの「困りごとを出す」。自分が担当のタスクに投稿する */
export function HelpDialog({
  tasks,
  initialTaskId,
  onClose,
  onPosted,
}: {
  tasks: LoadedBoardTask[];
  initialTaskId: string;
  onClose: () => void;
  onPosted: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [taskId, setTaskId] = useState(initialTaskId);
  const [body, setBody] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const issue = validateHelpBody(body)[0]?.message ?? null;
  const error = serverError ?? (submitted || [...body.trim()].length > HELP_BODY_MAX ? issue : null);
  const length = [...body.trim()].length;

  function submit() {
    setSubmitted(true);
    setServerError(null);
    if (issue || pending) return;
    startTransition(async () => {
      const r = await postHelp(taskId, body);
      if (r.ok) {
        onPosted();
        dialogRef.current?.close();
      } else if (r.error) {
        setServerError(r.error);
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-full max-w-[560px] rounded-modal border border-border bg-surface p-0 text-ink backdrop:bg-ink/40 max-sm:h-full max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none"
    >
      <form
        className="flex max-h-[90vh] flex-col max-sm:max-h-full"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-start gap-3 border-b border-divider px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-heading text-[20px] font-bold text-ink">
              困りごとを出す
            </h2>
            <p className="text-[13px] text-muted-foreground">解決するまで、チームボードのあなたのカードに赤く出ます。</p>
          </div>
          <button
            type="button"
            aria-label="閉じる"
            className="inline-flex size-11 items-center justify-center rounded-field text-ink-2 hover:bg-background"
            onClick={() => dialogRef.current?.close()}
          >
            <X aria-hidden="true" strokeWidth={2} className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {tasks.length > 1 ? (
            <Field id="help-task" label="どのタスクのことか" required>
              {(c) => (
                <select {...c} className={inputClass} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}（{t.projectName} · {formatPeriod(t.plannedStart, t.plannedEnd)}）
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : (
            <div>
              <p className="text-[13px] font-bold text-ink-2">タスク</p>
              <p className="text-[15px] font-bold text-ink">{tasks[0]?.name}</p>
            </div>
          )}
          <Field
            id="help-body"
            label="困っていること"
            required
            error={error}
            hint={`${length} / ${HELP_BODY_MAX} 文字。何で止まっているか、誰に何をしてほしいかを書くと伝わりやすいです。`}
          >
            {(c) => (
              <textarea
                {...c}
                rows={5}
                placeholder="例：API の認証で 401 が返ってきて先に進めません。認証まわりに詳しい人に見てほしいです。"
                className={cn(inputClass, "h-auto py-2")}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setServerError(null);
                }}
              />
            )}
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-divider px-6 py-4">
          <button type="button" className={secondaryButtonClass} onClick={() => dialogRef.current?.close()}>
            キャンセル
          </button>
          <button type="submit" className={primaryButtonClass} aria-disabled={(submitted && issue !== null) || pending ? true : undefined}>
            {pending ? "送信中…" : "出す"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
