"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { updateMyProgress } from "@/app/(app)/board/actions";
import { primaryButtonClass, secondaryButtonClass } from "@/components/common/buttons";
import { Field, inputClass } from "@/components/common/field";
import { ProjectTile } from "@/components/common/project-tile";
import { RuleAlert } from "@/components/common/rule-alert";
import { type ProgressUpdateField, validateProgressUpdate } from "@/lib/board";
import type { LoadedBoardTask } from "@/lib/board/server";
import type { IsoDate } from "@/lib/calendar";
import { formatPeriod } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  /** 自分が担当のタスク（own が入っているもの） */
  tasks: LoadedBoardTask[];
  initialTaskId: string;
  today: IsoDate;
  onClose: () => void;
  onSaved: () => void;
};

type Values = {
  progressPct: string;
  actualStart: string;
  actualEnd: string;
  deliverableUrl: string;
  completionNote: string;
};

function valuesOf(task: LoadedBoardTask): Values {
  return {
    progressPct: String(task.progressPct),
    actualStart: task.own?.actualStart ?? "",
    actualEnd: task.own?.actualEnd ?? "",
    deliverableUrl: task.own?.deliverableUrl ?? "",
    completionNote: task.own?.completionNote ?? "",
  };
}

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

/** 自分のカードの「進捗を更新」。進捗率・実績日・成果物 URL・メモだけを直せる（§6） */
export function ProgressDialog({ tasks, initialTaskId, today, onClose, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [taskId, setTaskId] = useState(initialTaskId);
  const task = tasks.find((t) => t.id === taskId) ?? tasks[0]!;
  const [values, setValues] = useState<Values>(() => valuesOf(task));
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<Record<ProgressUpdateField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const progress = Number(values.progressPct);
  const liveErrors = validateProgressUpdate(
    {
      progressPct: values.progressPct.trim() === "" ? Number.NaN : progress,
      actualStart: orNull(values.actualStart),
      actualEnd: orNull(values.actualEnd),
      deliverableUrl: orNull(values.deliverableUrl),
      completionNote: orNull(values.completionNote),
    },
    task,
    today,
  );
  const errors = submitted ? { ...serverErrors, ...liveErrors } : liveErrors.progressPct ? { progressPct: liveErrors.progressPct } : {};
  const blocked = Object.keys(liveErrors).length > 0;

  function set<K extends keyof Values>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setServerErrors({});
  }

  function chooseTask(id: string) {
    const next = tasks.find((t) => t.id === id);
    if (!next) return;
    setTaskId(id);
    setValues(valuesOf(next));
    setSubmitted(false);
    setServerErrors({});
    setFormError(null);
  }

  function submit() {
    setSubmitted(true);
    setFormError(null);
    if (blocked || pending) return;
    startTransition(async () => {
      const r = await updateMyProgress(task.id, { ...values, progressPct: progress });
      if (r.ok) {
        onSaved();
        dialogRef.current?.close();
        return;
      }
      setServerErrors(r.errors ?? {});
      if (r.formError) setFormError(r.formError);
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
          <ProjectTile color={task.projectColor} icon={task.projectIcon} />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-heading text-[20px] font-bold text-ink">
              進捗を更新
            </h2>
            <p className="truncate text-[13px] text-muted-foreground">
              {task.projectName} · {formatPeriod(task.plannedStart, task.plannedEnd)}
            </p>
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
          {formError && <RuleAlert tone="error" title={formError} />}

          {tasks.length > 1 ? (
            <Field id="progress-task" label="タスク">
              {(c) => (
                <select {...c} className={inputClass} value={taskId} onChange={(e) => chooseTask(e.target.value)}>
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
              <p className="text-[15px] font-bold text-ink">{task.name}</p>
            </div>
          )}
          <p className="text-[13px] text-ink-2">成果物：{task.deliverable}</p>

          <Field id="progress-pct" label="進捗率（%）" required error={errors.progressPct}>
            {(c) => (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  aria-label="進捗率のスライダー"
                  className="flex-1 accent-primary"
                  value={Number.isFinite(progress) ? progress : 0}
                  onChange={(e) => set("progressPct", e.target.value)}
                />
                <input
                  {...c}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  className={cn(inputClass, "w-24 text-right")}
                  value={values.progressPct}
                  onChange={(e) => set("progressPct", e.target.value)}
                />
              </div>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="actual-start" label="実績開始日" error={errors.actualStart}>
              {(c) => (
                <input
                  {...c}
                  type="date"
                  max={today}
                  className={inputClass}
                  value={values.actualStart}
                  onChange={(e) => set("actualStart", e.target.value)}
                />
              )}
            </Field>
            <Field id="actual-end" label="実績終了日" error={errors.actualEnd}>
              {(c) => (
                <input
                  {...c}
                  type="date"
                  max={today}
                  className={inputClass}
                  value={values.actualEnd}
                  onChange={(e) => set("actualEnd", e.target.value)}
                />
              )}
            </Field>
          </div>

          <Field
            id="deliverable-url"
            label="成果物の URL"
            error={errors.deliverableUrl}
            hint="完了（100%）にするときは、成果物の URL かメモのどちらかが必要です。"
            required={progress === 100}
          >
            {(c) => (
              <input
                {...c}
                type="url"
                inputMode="url"
                placeholder="https://"
                className={inputClass}
                value={values.deliverableUrl}
                onChange={(e) => set("deliverableUrl", e.target.value)}
              />
            )}
          </Field>
          <Field id="completion-note" label="メモ">
            {(c) => (
              <textarea
                {...c}
                rows={3}
                placeholder="例：PR #12 でマージ済み"
                className={cn(inputClass, "h-auto py-2")}
                value={values.completionNote}
                onChange={(e) => set("completionNote", e.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-divider px-6 py-4">
          <button type="button" className={secondaryButtonClass} onClick={() => dialogRef.current?.close()}>
            キャンセル
          </button>
          <button type="submit" className={primaryButtonClass} aria-disabled={(submitted && blocked) || pending ? true : undefined}>
            {pending ? "保存中…" : "保存"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
