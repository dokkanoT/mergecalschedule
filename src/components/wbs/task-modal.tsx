"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/common/buttons";
import { Field, inputClass } from "@/components/common/field";
import { ProjectTile } from "@/components/common/project-tile";
import { RuleAlert } from "@/components/common/rule-alert";
import {
  checkTaskSchedule,
  duplicateTaskForMembers,
  saveTask,
  type TaskSaveResult,
} from "@/app/(app)/projects/[id]/wbs/actions";
import { addWorkdays, type IsoDate, isIsoDate, workdaysBetween } from "@/lib/calendar";
import { formatDateWithWeekday, formatPeriod } from "@/lib/format";
import { bufferPeriod, DELIVERABLE_EXAMPLES, validateTaskDates } from "@/lib/rules";
import { offdayNote } from "@/lib/wbs";
import type { OverlapCheck } from "@/lib/wbs/server";
import { cn } from "@/lib/utils";
import type { TaskModalState, WbsMember, WbsNode, WbsProject } from "./types";

type Props = {
  project: WbsProject;
  state: NonNullable<TaskModalState>;
  phases: WbsNode[];
  members: WbsMember[];
  onClose: () => void;
  onDelete: (taskId: string) => Promise<{ error?: string }>;
};

type Errors = NonNullable<TaskSaveResult["errors"]>;

/** タスクの作成・編集（SCREENS.md §5-4）。ルール違反中は保存できない */
export function TaskModal({ project, state, phases, members, onClose, onDelete }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const editing = state.mode === "edit" ? state.task : null;

  const [phaseId, setPhaseId] = useState(editing?.phaseId ?? (state.mode === "create" ? state.phaseId : null) ?? phases[0]?.id ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [deliverable, setDeliverable] = useState(editing?.deliverable ?? "");
  const [assigneeId, setAssigneeId] = useState(editing?.assigneeId ?? "");
  const [plannedStart, setPlannedStart] = useState(editing?.plannedStart ?? "");
  const [plannedEnd, setPlannedEnd] = useState(editing?.plannedEnd ?? "");
  const [duplicate, setDuplicate] = useState(false);
  const [dupMembers, setDupMembers] = useState<string[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [overlap, setOverlap] = useState<OverlapCheck | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // 入力中の並列禁止チェック（R3）。担当者と期間が決まったら、サーバーに全プロジェクト分を問い合わせる
  const datesValid = isIsoDate(plannedStart) && isIsoDate(plannedEnd) && plannedStart <= plannedEnd;
  useEffect(() => {
    if (duplicate || !assigneeId || !datesValid) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      checkTaskSchedule(project.id, { assigneeId, plannedStart, plannedEnd, excludeTaskId: editing?.id }).then((r) => {
        if (!cancelled) setOverlap(r);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [project.id, assigneeId, plannedStart, plannedEnd, datesValid, duplicate, editing?.id]);
  const conflicts = !duplicate && assigneeId && datesValid ? (overlap?.conflicts ?? []) : [];

  // 画面でもすぐに判定する（保存時はサーバーで同じ関数を使う）
  const dateIssues = validateTaskDates({ plannedStart, plannedEnd });
  const dateError = (field: "plannedStart" | "plannedEnd") =>
    serverErrors[field] ?? (touched[field] || (plannedStart && plannedEnd) ? dateIssues.find((i) => i.field === field)?.message : undefined);
  const nameError = serverErrors.name ?? (touched.name && name.trim() === "" ? "タスク名を入力してください。" : undefined);
  const deliverableError =
    serverErrors.deliverable ?? (touched.deliverable && deliverable.trim() === "" ? "成果物を入力してください。成果物がないタスクは保存できません。" : undefined);
  const assigneeMissing = duplicate ? dupMembers.length === 0 : assigneeId === "";

  const workdays = datesValid ? workdaysBetween(plannedStart, plannedEnd) : 0;
  const note = datesValid ? offdayNote(plannedStart, plannedEnd) : null;
  const buffer = bufferPeriod(project.deadline, project.bufferDays);
  const intoBuffer = datesValid && plannedEnd > buffer.latestPlannedEnd;

  const blocked =
    name.trim() === "" ||
    deliverable.trim() === "" ||
    assigneeMissing ||
    !phaseId ||
    dateIssues.length > 0 ||
    conflicts.length > 0;

  const assigneeName = members.find((m) => m.userId === assigneeId)?.name ?? "";

  function moveToSuggested(start: IsoDate) {
    const length = Math.max(1, workdays);
    setPlannedStart(start);
    setPlannedEnd(addWorkdays(start, length - 1));
    setServerErrors({});
  }

  function submit() {
    setTouched({ name: true, deliverable: true, plannedStart: true, plannedEnd: true });
    if (blocked) return;
    setFormError(null);
    setServerErrors({});
    startTransition(async () => {
      const base = { phaseId, name, deliverable, plannedStart, plannedEnd };
      const r = duplicate
        ? await duplicateTaskForMembers(project.id, base, dupMembers)
        : await saveTask(project.id, { ...base, id: editing?.id, assigneeId });
      if (r.ok) {
        onClose();
        return;
      }
      setServerErrors(r.errors ?? {});
      if (r.formError) setFormError(r.formError);
      if (r.overlap) setOverlap(r.overlap);
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
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <div className="flex items-start gap-3 border-b border-divider px-6 py-5">
          <ProjectTile color={project.color} icon={project.icon} />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-heading text-[20px] font-bold text-ink">
              {editing ? "タスクを編集" : "タスクを追加"}
            </h2>
            <p className="truncate text-[13px] text-muted-foreground">
              {project.name} · フェーズ：{phases.find((p) => p.id === phaseId)?.name ?? "未選択"}
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

          {(state.mode === "create" && state.phaseId === null) || editing ? (
            <Field id="task-phase" label="フェーズ" required error={serverErrors.phaseId}>
              {(c) => (
                <select {...c} className={inputClass} value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : null}

          <Field id="task-name" label="タスク名" required error={nameError}>
            {(c) => (
              <input
                {...c}
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                placeholder="例：メイン画面のレイアウト"
                autoFocus
              />
            )}
          </Field>

          <Field
            id="task-deliverable"
            label="成果物（スコープ）"
            required
            error={deliverableError}
            hint="分割できる最小単位で。成果物がないタスクは保存できません。"
          >
            {(c) => (
              <input
                {...c}
                className={inputClass}
                value={deliverable}
                onChange={(e) => setDeliverable(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, deliverable: true }))}
                placeholder={`例：${DELIVERABLE_EXAMPLES[0]}`}
              />
            )}
          </Field>

          {duplicate ? (
            <fieldset className="space-y-2">
              <legend className="text-[13px] font-bold text-ink-2">
                担当者（メンバー分複製）<span className="ml-1 text-[12px] font-medium text-muted-foreground">必須</span>
              </legend>
              <p className="text-[12px] text-muted-foreground">
                選んだ人数分、同じ内容のタスクを1人1件ずつ作ります。1人でも期間が重なる人がいると作れません。
              </p>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const checked = dupMembers.includes(m.userId);
                  return (
                    <label
                      key={m.userId}
                      className={cn(
                        "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-[14px]",
                        checked ? "border-primary bg-primary-soft text-primary-soft-ink" : "border-border-strong",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={checked}
                        onChange={() =>
                          setDupMembers((ids) => (checked ? ids.filter((id) => id !== m.userId) : [...ids, m.userId]))
                        }
                      />
                      {m.name}
                    </label>
                  );
                })}
              </div>
              {serverErrors.assigneeId && <p className="text-[13px] font-medium text-help-ink">{serverErrors.assigneeId}</p>}
              <button type="button" className="text-[13px] text-primary underline-offset-4 hover:underline" onClick={() => setDuplicate(false)}>
                1人を選ぶに戻す
              </button>
            </fieldset>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <Field id="task-assignee" label="担当者（1人）" required error={serverErrors.assigneeId} className="min-w-48 flex-1">
                {(c) => (
                  <select {...c} className={inputClass} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                    <option value="">選んでください</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {!editing && (
                <button type="button" className={secondaryButtonClass} onClick={() => setDuplicate(true)}>
                  メンバー分複製
                </button>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="task-start" label="開始日" required error={conflicts.length > 0 ? undefined : dateError("plannedStart")}>
              {(c) => (
                <input
                  {...c}
                  aria-invalid={c["aria-invalid"] ?? (conflicts.length > 0 ? true : undefined)}
                  type="date"
                  className={inputClass}
                  value={plannedStart}
                  onChange={(e) => {
                    setPlannedStart(e.target.value);
                    setServerErrors((s) => ({ ...s, plannedStart: undefined }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, plannedStart: true }))}
                />
              )}
            </Field>
            <Field id="task-end" label="終了日" required error={dateError("plannedEnd")}>
              {(c) => (
                <input
                  {...c}
                  type="date"
                  className={inputClass}
                  value={plannedEnd}
                  min={plannedStart || undefined}
                  onChange={(e) => {
                    setPlannedEnd(e.target.value);
                    setServerErrors((s) => ({ ...s, plannedEnd: undefined }));
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, plannedEnd: true }))}
                />
              )}
            </Field>
          </div>
          {datesValid && dateIssues.length === 0 && (
            <p className="text-[13px] text-ink-2">
              稼働日 {workdays}日{note ? `（${note}）` : ""}
            </p>
          )}

          {conflicts.length > 0 && (
            <RuleAlert tone="error" title={`${assigneeName}さんはこの期間、別のタスクを担当中です`}>
              <ul className="space-y-2">
                {conflicts.map((c) => (
                  <li key={c.taskId} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2">
                    {c.projectColor && c.projectIcon ? (
                      <ProjectTile color={c.projectColor} icon={c.projectIcon} size="sm" />
                    ) : (
                      <span aria-hidden="true" className="size-7 shrink-0 rounded-tile-sm bg-free-bg" />
                    )}
                    <div className="min-w-0 text-ink">
                      <p className="truncate font-bold">{c.taskName ?? "別プロジェクトの予定"}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {c.projectName ? `${c.projectName} · ` : ""}
                        {formatPeriod(c.plannedStart, c.plannedEnd)}
                        {c.progressPct !== null ? ` · 進捗 ${c.progressPct}%` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <p>1人が同時に持てるタスクは1つまで。プロジェクトが違っても同じです。</p>
              {overlap?.suggestedStart && (
                <button
                  type="button"
                  className="mt-1 inline-flex min-h-11 items-center rounded-field bg-help-strong px-4 text-[14px] font-bold text-white"
                  onClick={() => moveToSuggested(overlap.suggestedStart!)}
                >
                  {formatDateWithWeekday(overlap.suggestedStart)}から始める
                </button>
              )}
            </RuleAlert>
          )}

          {intoBuffer && conflicts.length === 0 && (
            <RuleAlert tone="warn" title="予備期間（バッファ）に入っています">
              <p>
                予備期間は {formatPeriod(buffer.start, buffer.end)}。最終タスクは {formatDateWithWeekday(buffer.latestPlannedEnd)}{" "}
                までに終える計画にしてください（保存はできます）。
              </p>
            </RuleAlert>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-divider px-6 py-4">
          {editing &&
            (confirmingDelete ? (
              <div role="group" aria-label="タスクを消すか確認" className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-help-body">このタスクを消しますか？</span>
                <button
                  type="button"
                  className="min-h-11 rounded-field bg-help-strong px-4 text-[14px] font-bold text-white"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await onDelete(editing.id);
                      if (r.error) setFormError(r.error);
                      else onClose();
                    })
                  }
                >
                  消す
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setConfirmingDelete(false)}>
                  やめる
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="min-h-11 rounded-field px-3 text-[14px] font-medium text-help-strong hover:bg-help-bg"
                onClick={() => setConfirmingDelete(true)}
              >
                タスクを消す
              </button>
            ))}
          <div className="ml-auto flex gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => dialogRef.current?.close()}>
              キャンセル
            </button>
            <button type="submit" className={primaryButtonClass} aria-disabled={blocked || pending ? true : undefined}>
              {pending ? "保存中…" : duplicate ? `${dupMembers.length}人分を保存` : "保存"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
