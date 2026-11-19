"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { dashedButtonClass, primaryButtonClass, secondaryButtonClass } from "@/components/common/buttons";
import { EmptyState } from "@/components/common/empty-state";
import { MemberAvatar } from "@/components/common/member-avatar";
import { ProgressBar } from "@/components/common/progress-bar";
import { ProjectTile } from "@/components/common/project-tile";
import { RuleAlert } from "@/components/common/rule-alert";
import { StatusPill } from "@/components/common/status-pill";
import { deleteNode, deleteTask, moveNode, moveTask, saveNode } from "@/app/(app)/projects/[id]/wbs/actions";
import { type IsoDate, workdaysBetween } from "@/lib/calendar";
import { formatPeriod, formatWorkdays } from "@/lib/format";
import { progressStatus } from "@/lib/progress";
import { tintOf } from "@/lib/project-style";
import { cn } from "@/lib/utils";
import { InlineNameForm } from "./inline-name-form";
import { DeleteIcon, EditIcon, IconButton, MoveButtons } from "./small-buttons";
import { TaskModal } from "./task-modal";
import type { TaskModalState, WbsMember, WbsNode, WbsProject, WbsTask } from "./types";

type Props = {
  project: WbsProject;
  nodes: WbsNode[];
  tasks: WbsTask[];
  members: WbsMember[];
  canEdit: boolean;
  today: IsoDate;
};

type Editing =
  | { kind: "add-goal" }
  | { kind: "add-phase"; goalId: string }
  | { kind: "rename"; nodeId: string }
  | null;

/** WBS 編集（目的 > フェーズ > タスク）。owner は編集、member は読み取りのみ */
export function WbsEditor({ project, nodes, tasks, members, canEdit, today }: Props) {
  const [editing, setEditing] = useState<Editing>(null);
  const [modal, setModal] = useState<TaskModalState>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const goals = nodes.filter((n) => n.level === "goal");
  const phasesOf = (goalId: string) => nodes.filter((n) => n.level === "phase" && n.parentId === goalId);
  const tasksOf = (phaseId: string) => tasks.filter((t) => t.phaseId === phaseId);
  const phases = nodes.filter((n) => n.level === "phase");

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  };

  return (
    <div className="space-y-5">
      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() =>
              setEditing(goals.length === 0 ? { kind: "add-goal" } : { kind: "add-phase", goalId: goals.at(-1)!.id })
            }
          >
            <Plus aria-hidden="true" strokeWidth={2} />
            {goals.length === 0 ? "目的" : "フェーズ"}
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={phases.length === 0}
            title={phases.length === 0 ? "先にフェーズを作ってください" : undefined}
            onClick={() => setModal({ mode: "create", phaseId: null })}
          >
            <Plus aria-hidden="true" strokeWidth={2} />
            タスク
          </button>
        </div>
      )}

      {error && <RuleAlert tone="error" title={error} />}

      {goals.length === 0 && editing?.kind !== "add-goal" && (
        <EmptyState
          action={
            canEdit && (
              <button type="button" className={primaryButtonClass} onClick={() => setEditing({ kind: "add-goal" })}>
                <Plus aria-hidden="true" strokeWidth={2} />
                目的を入れる
              </button>
            )
          }
        >
          {canEdit
            ? "まだ WBS がありません。まず、このプロジェクトの目的を1行で入れてください。"
            : "まだ WBS がありません。オーナーが作るまでお待ちください。"}
        </EmptyState>
      )}

      {goals.map((goal, gi) => (
        <div key={goal.id} className="space-y-4">
          <section aria-label={`目的：${goal.name}`} className="rounded-card border border-border bg-surface p-5">
            {editing?.kind === "rename" && editing.nodeId === goal.id ? (
              <InlineNameForm
                id={`rename-${goal.id}`}
                label="目的"
                initial={goal.name}
                submitLabel="保存"
                onSubmit={(name) => saveNode(project.id, { id: goal.id, level: "goal", name })}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-muted-foreground">目的</p>
                  <p className="font-heading text-[18px] font-bold text-ink">{goal.name}</p>
                </div>
                {canEdit && (
                  <NodeActions
                    label={goal.name}
                    isFirst={gi === 0}
                    isLast={gi === goals.length - 1}
                    disabled={pending}
                    confirming={confirmDelete === goal.id}
                    deleteNote="配下のフェーズとタスクも消えます。"
                    onMove={(d) => run(() => moveNode(project.id, goal.id, d))}
                    onRename={() => setEditing({ kind: "rename", nodeId: goal.id })}
                    onAskDelete={() => setConfirmDelete(goal.id)}
                    onCancelDelete={() => setConfirmDelete(null)}
                    onDelete={() => run(() => deleteNode(project.id, goal.id))}
                  />
                )}
              </div>
            )}
          </section>

          {phasesOf(goal.id).map((phase, pi, list) => (
            <PhaseCard
              key={phase.id}
              project={project}
              phase={phase}
              tasks={tasksOf(phase.id)}
              canEdit={canEdit}
              today={today}
              isFirst={pi === 0}
              isLast={pi === list.length - 1}
              pending={pending}
              renaming={editing?.kind === "rename" && editing.nodeId === phase.id}
              confirmingDelete={confirmDelete === phase.id}
              onRename={() => setEditing({ kind: "rename", nodeId: phase.id })}
              onRenameDone={() => setEditing(null)}
              onAskDelete={() => setConfirmDelete(phase.id)}
              onCancelDelete={() => setConfirmDelete(null)}
              onDelete={() => run(() => deleteNode(project.id, phase.id))}
              onMove={(d) => run(() => moveNode(project.id, phase.id, d))}
              onMoveTask={(taskId, d) => run(() => moveTask(project.id, taskId, d))}
              onAddTask={() => setModal({ mode: "create", phaseId: phase.id })}
              onEditTask={(task) => setModal({ mode: "edit", task })}
            />
          ))}

          {canEdit &&
            (editing?.kind === "add-phase" && editing.goalId === goal.id ? (
              <div className="rounded-card border border-border bg-surface p-5">
                <InlineNameForm
                  id={`add-phase-${goal.id}`}
                  label="フェーズ名"
                  placeholder="例：設計"
                  submitLabel="フェーズを追加"
                  onSubmit={(name) => saveNode(project.id, { level: "phase", parentId: goal.id, name })}
                  onDone={() => setEditing(null)}
                />
              </div>
            ) : (
              <button
                type="button"
                className={cn(dashedButtonClass, "w-full")}
                onClick={() => setEditing({ kind: "add-phase", goalId: goal.id })}
              >
                <Plus aria-hidden="true" strokeWidth={2} />
                この目的にフェーズを追加
              </button>
            ))}
        </div>
      ))}

      {canEdit && editing?.kind === "add-goal" && (
        <div className="rounded-card border border-border bg-surface p-5">
          <p className="mb-2 text-[12px] font-bold text-muted-foreground">目的</p>
          <InlineNameForm
            id="add-goal"
            label="目的"
            placeholder="例：本の記録アプリを公開する"
            submitLabel="目的を追加"
            onSubmit={(name) => saveNode(project.id, { level: "goal", name })}
            onDone={() => setEditing(null)}
          />
        </div>
      )}

      {canEdit && goals.length > 0 && editing?.kind !== "add-goal" && (
        <button type="button" className={cn(dashedButtonClass, "w-full")} onClick={() => setEditing({ kind: "add-goal" })}>
          <Plus aria-hidden="true" strokeWidth={2} />
          目的を追加
        </button>
      )}

      {modal && (
        <TaskModal
          key={modal.mode === "edit" ? modal.task.id : `new-${modal.phaseId}`}
          project={project}
          state={modal}
          phases={phases}
          members={members}
          onClose={() => setModal(null)}
          onDelete={(taskId) => deleteTask(project.id, taskId)}
        />
      )}
    </div>
  );
}

function NodeActions(props: {
  label: string;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  confirming: boolean;
  deleteNote: string;
  onMove: (d: "up" | "down") => void;
  onRename: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  if (props.confirming) {
    return (
      <div role="group" aria-label={`${props.label} を消すか確認`} className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-help-body">「{props.label}」を消しますか？{props.deleteNote}</span>
        <button
          type="button"
          className="min-h-9 rounded-field bg-help-strong px-3 text-[13px] font-bold text-white"
          onClick={props.onDelete}
        >
          消す
        </button>
        <button
          type="button"
          className="min-h-9 rounded-field border border-border-strong bg-surface px-3 text-[13px] text-ink"
          onClick={props.onCancelDelete}
          autoFocus
        >
          やめる
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center">
      <MoveButtons label={props.label} isFirst={props.isFirst} isLast={props.isLast} onMove={props.onMove} disabled={props.disabled} />
      <IconButton aria-label={`${props.label} の名前を変える`} onClick={props.onRename}>
        <EditIcon />
      </IconButton>
      <IconButton aria-label={`${props.label} を消す`} onClick={props.onAskDelete} className="text-help-strong">
        <DeleteIcon />
      </IconButton>
    </div>
  );
}

function PhaseCard(props: {
  project: WbsProject;
  phase: WbsNode;
  tasks: WbsTask[];
  canEdit: boolean;
  today: IsoDate;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  renaming: boolean;
  confirmingDelete: boolean;
  onRename: () => void;
  onRenameDone: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  onMove: (d: "up" | "down") => void;
  onMoveTask: (taskId: string, d: "up" | "down") => void;
  onAddTask: () => void;
  onEditTask: (task: WbsTask) => void;
}) {
  const { project, phase, tasks, canEdit, today } = props;
  const start = tasks.reduce<string | null>((m, t) => (m === null || t.plannedStart < m ? t.plannedStart : m), null);
  const end = tasks.reduce<string | null>((m, t) => (m === null || t.plannedEnd > m ? t.plannedEnd : m), null);
  const headingId = `phase-${phase.id}`;

  return (
    <section aria-labelledby={headingId} className="rounded-card border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-divider px-5 py-4">
        {props.renaming ? (
          <div className="flex-1">
            <InlineNameForm
              id={`rename-${phase.id}`}
              label="フェーズ名"
              initial={phase.name}
              submitLabel="保存"
              onSubmit={(name) => saveNode(project.id, { id: phase.id, level: "phase", name })}
              onDone={props.onRenameDone}
            />
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <h2 id={headingId} className="text-[16px] font-bold text-ink">
                {phase.name}
              </h2>
              <p className="text-[12px] text-muted-foreground">
                {tasks.length}タスク{start && end ? ` · ${formatPeriod(start, end)}` : ""}
              </p>
            </div>
            {canEdit && (
              <>
                <NodeActions
                  label={phase.name}
                  isFirst={props.isFirst}
                  isLast={props.isLast}
                  disabled={props.pending}
                  confirming={props.confirmingDelete}
                  deleteNote="このフェーズのタスクも消えます。"
                  onMove={props.onMove}
                  onRename={props.onRename}
                  onAskDelete={props.onAskDelete}
                  onCancelDelete={props.onCancelDelete}
                  onDelete={props.onDelete}
                />
                <button type="button" className={cn(dashedButtonClass, "min-h-9")} onClick={props.onAddTask}>
                  <Plus aria-hidden="true" strokeWidth={2} />
                  このフェーズにタスク
                </button>
              </>
            )}
          </>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="px-5 py-6 text-[14px] text-muted-foreground">まだタスクがありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-divider text-[12px] text-muted-foreground">
                <th scope="col" className="px-5 py-2 font-bold">タスク</th>
                <th scope="col" className="px-3 py-2 font-bold">成果物（スコープ）</th>
                <th scope="col" className="px-3 py-2 font-bold">担当</th>
                <th scope="col" className="px-3 py-2 font-bold">期間</th>
                <th scope="col" className="px-3 py-2 font-bold">稼働日</th>
                <th scope="col" className="px-3 py-2 font-bold">進捗</th>
                {canEdit && <th scope="col" className="px-3 py-2"><span className="sr-only">操作</span></th>}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => {
                const late = progressStatus(t, today) === "behind";
                return (
                  <tr key={t.id} className="border-b border-divider last:border-b-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <ProjectTile color={project.color} icon={project.icon} size="sm" />
                        <span className="font-bold text-ink">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink-2">{t.deliverable}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <MemberAvatar name={t.assigneeName} tint={tintOf(project.color)} size="sm" />
                        <span className="text-ink">{t.assigneeName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-2">
                      {formatPeriod(t.plannedStart, t.plannedEnd)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-2">
                      {formatWorkdays(workdaysBetween(t.plannedStart, t.plannedEnd))}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar pct={t.progressPct} color={project.color} label={`${t.name} の進捗`} />
                        {late && <StatusPill status="late" />}
                      </div>
                    </td>
                    {canEdit && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end">
                          <MoveButtons
                            label={t.name}
                            isFirst={i === 0}
                            isLast={i === tasks.length - 1}
                            disabled={props.pending}
                            onMove={(d) => props.onMoveTask(t.id, d)}
                          />
                          <IconButton aria-label={`${t.name} を編集`} onClick={() => props.onEditTask(t)}>
                            <EditIcon />
                          </IconButton>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
