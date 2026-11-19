"use client";

import { CalendarDays, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { ProjectTile } from "@/components/common/project-tile";
import { StatusPill } from "@/components/common/status-pill";
import { OTHER_PROJECT_LABEL } from "@/lib/board";
import type { LoadedBoardTask } from "@/lib/board/server";
import type { IsoDate } from "@/lib/calendar";
import { formatPeriod } from "@/lib/format";
import { progressStatus } from "@/lib/progress";

/** カードを押したときの、そのメンバーの担当タスク一覧（シンプルなリスト。時系列のタイムラインは第2版） */
export function TaskListDialog({
  memberName,
  tasks,
  today,
  currentId,
  onClose,
}: {
  memberName: string;
  tasks: LoadedBoardTask[];
  today: IsoDate;
  currentId: string | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-full max-w-[560px] rounded-modal border border-border bg-surface p-0 text-ink backdrop:bg-ink/40 max-sm:h-full max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none"
    >
      <div className="flex max-h-[90vh] flex-col max-sm:max-h-full">
        <div className="flex items-start gap-3 border-b border-divider px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-heading text-[20px] font-bold text-ink">
              {memberName}さんの担当タスク
            </h2>
            <p className="text-[13px] text-muted-foreground">{tasks.length}件 · 開始日の早い順</p>
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

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tasks.length === 0 ? (
            <p className="rounded-card border border-dashed border-border-strong px-6 py-8 text-center text-[14px] text-ink-2">
              担当しているタスクはまだありません。
            </p>
          ) : (
            <ul className="divide-y divide-divider">
              {tasks.map((t) => {
                const late = t.visible && t.progressPct < 100 && progressStatus(t, today) === "behind";
                return (
                  <li key={t.id} className="flex items-center gap-3 py-3">
                    {t.visible ? (
                      <ProjectTile color={t.projectColor} icon={t.projectIcon} size="sm" />
                    ) : (
                      <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-tile-sm bg-free-bg text-ink-2">
                        <CalendarDays strokeWidth={2} className="size-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-ink">
                        {t.id === currentId && <span className="mr-1.5 text-primary-soft-ink">いま</span>}
                        {t.visible ? t.name : OTHER_PROJECT_LABEL}
                      </p>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {t.visible ? `${t.projectName} · ` : ""}
                        {formatPeriod(t.plannedStart, t.plannedEnd)}
                        {t.visible ? ` · 進捗 ${t.progressPct}%` : ""}
                      </p>
                    </div>
                    {late && <StatusPill status="late" />}
                    {t.visible && t.progressPct >= 100 && <StatusPill status="ok" label="完了" />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}
