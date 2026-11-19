"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { primaryButtonClass } from "@/components/common/buttons";
import { MemberAvatar } from "@/components/common/member-avatar";
import { ProgressBar } from "@/components/common/progress-bar";
import { ProjectDot, ProjectTile } from "@/components/common/project-tile";
import { StatusPill, type StatusKind } from "@/components/common/status-pill";
import { Toast } from "@/components/common/toast";
import { type CardStatus, type MemberCard, OTHER_PROJECT_LABEL } from "@/lib/board";
import type { LoadedBoardTask } from "@/lib/board/server";
import type { IsoDate } from "@/lib/calendar";
import { formatDateWithWeekday, formatMonthDay, formatPeriod, formatWorkdays } from "@/lib/format";
import { tintOf } from "@/lib/project-style";
import { ProgressDialog } from "./progress-dialog";
import { TaskListDialog } from "./task-list-dialog";

const PILL: Record<CardStatus, { kind: StatusKind; label?: string }> = {
  help: { kind: "help" },
  late: { kind: "late" },
  ok: { kind: "ok" },
  other: { kind: "free", label: "予定あり" },
  free: { kind: "free" },
};

type Props = {
  card: MemberCard;
  /** そのメンバーの全タスク（開始日の早い順） */
  tasks: LoadedBoardTask[];
  isMe: boolean;
  today: IsoDate;
};

/** メンバーカード（SCREENS.md §5-1）。1メンバー = 1枚 */
export function MemberCardView({ card, tasks, isMe, today }: Props) {
  const [dialog, setDialog] = useState<"list" | "progress" | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const { member, current, next } = card;
  const pill = PILL[card.status];
  const currentTint = current?.visible ? tintOf(current.projectColor) : null;
  const subtitle = [isMe ? "あなた" : null, member.title].filter(Boolean).join(" · ");
  const ownTasks = tasks.filter((t) => t.own !== null);

  return (
    <article className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5" aria-label={`${member.name}さん`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`${member.name}さんの担当タスク一覧を開く`}
          className="group -m-1 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-field p-1 text-left outline-none hover:bg-background focus-visible:ring-3 focus-visible:ring-primary/30"
          onClick={() => setDialog("list")}
        >
          <MemberAvatar name={member.name} tint={currentTint} />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold break-words text-ink underline-offset-4 group-hover:underline">{member.name}</span>
            {subtitle && <span className="block truncate text-[12px] text-muted-foreground">{subtitle}</span>}
          </span>
        </button>
        <StatusPill status={pill.kind} label={pill.label} />
      </div>

      <div className="grid grid-cols-[44px_1fr] gap-x-3">
        {/* いま */}
        <div className="flex flex-col items-center">
          <NowTile task={current} />
          <span aria-hidden="true" className="my-1 w-0 flex-1 border-l-2 border-dotted border-timeline-dot" />
        </div>
        <div className="min-w-0 space-y-1.5 pb-4">
          <NowBody card={card} today={today} />
        </div>

        {/* つぎ */}
        <div className="flex justify-center">
          {next?.visible ? (
            <ProjectTile color={next.projectColor} icon={next.projectIcon} size="sm" outline />
          ) : (
            <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-tile-sm bg-free-bg text-ink-2">
              <CalendarDays strokeWidth={2} className="size-4" />
            </span>
          )}
        </div>
        <div className="min-w-0 space-y-0.5">
          {next ? (
            <>
              <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
                <span className="font-bold text-ink-2">つぎ</span>
                <span>·</span>
                <span className="truncate">{next.visible ? next.projectName : OTHER_PROJECT_LABEL}</span>
                <span>·</span>
                <span>{formatPeriod(next.plannedStart, next.plannedEnd)}</span>
              </p>
              {next.visible && <p className="truncate text-[14px] font-medium text-ink">{next.name}</p>}
            </>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              <span className="font-bold text-ink-2">つぎ</span> · 予定なし
            </p>
          )}
        </div>
      </div>

      {card.overdue.length > 0 && (
        <p className="rounded-2xl bg-late-bg px-4 py-3 text-[13px] text-late-ink">
          終了予定を過ぎたタスクが {card.overdue.length}件 あります（
          {card.overdue
            .slice(0, 2)
            .map((t) => `${t.name} · ${formatMonthDay(t.plannedEnd, today)}まで · ${t.progressPct}%`)
            .join("、")}
          {card.overdue.length > 2 && " ほか"}）
        </p>
      )}

      {card.openHelpCount > 0 && (
        <p className="rounded-2xl bg-help-bg px-4 py-3 text-[13px] font-bold text-help-ink">
          未解決の困りごとが {card.openHelpCount}件 あります
        </p>
      )}

      {isMe && ownTasks.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-2">
          <button type="button" aria-haspopup="dialog" className={primaryButtonClass} onClick={() => setDialog("progress")}>
            進捗を更新
          </button>
        </div>
      )}

      {dialog === "list" && (
        <TaskListDialog memberName={member.name} tasks={tasks} today={today} currentId={current?.id ?? null} onClose={() => setDialog(null)} />
      )}
      {dialog === "progress" && (
        <ProgressDialog
          tasks={ownTasks}
          initialTaskId={[current, card.overdue[0], next].find((t) => t && ownTasks.some((o) => o.id === t.id))?.id ?? ownTasks[0]!.id}
          today={today}
          onClose={() => setDialog(null)}
          onSaved={() => setSavedAt(Date.now())}
        />
      )}
      {savedAt !== null && <Toast key={savedAt} message="保存しました" />}
    </article>
  );
}

function NowTile({ task }: { task: MemberCard["current"] }) {
  if (task?.visible) return <ProjectTile color={task.projectColor} icon={task.projectIcon} />;
  if (task) {
    return (
      <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-tile bg-free-bg text-ink-2">
        <CalendarDays strokeWidth={2} className="size-5" />
      </span>
    );
  }
  return <span aria-hidden="true" className="inline-block size-11 rounded-tile border-2 border-dashed border-border-strong" />;
}

function NowBody({ card, today }: { card: MemberCard; today: IsoDate }) {
  const task = card.current;
  if (!task) {
    return (
      <>
        <p className="text-[15px] font-bold text-ink">今日は担当タスクなし</p>
        <p className="text-[13px] text-ink-2">
          {card.free === null
            ? card.next
              ? `次のタスクは ${formatDateWithWeekday(card.next.plannedStart, today)} からです`
              : "予定は入っていません"
            : card.free.until === null
              ? `${formatDateWithWeekday(card.free.from, today)} から空いています`
              : `${formatPeriod(card.free.from, card.free.until)} は空いています`}
        </p>
      </>
    );
  }
  if (!task.visible) {
    return (
      <>
        <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
          <span className="font-bold text-ink-2">いま</span>
          <span>·</span>
          <span>{formatPeriod(task.plannedStart, task.plannedEnd)}</span>
        </p>
        <p className="text-[15px] font-bold text-ink">{OTHER_PROJECT_LABEL}</p>
        <p className="text-[13px] text-ink-2">終了予定まで あと{formatWorkdays(card.remaining)}</p>
      </>
    );
  }
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
        <ProjectDot color={task.projectColor} />
        <span className="font-bold text-ink-2">いま</span>
        <span>·</span>
        <span className="truncate">{task.projectName}</span>
        <span>·</span>
        <span>{formatPeriod(task.plannedStart, task.plannedEnd)}</span>
      </p>
      <p className="text-[15px] font-bold break-words text-ink">{task.name}</p>
      <p className="text-[13px] break-words text-ink-2">成果物：{task.deliverable}</p>
      <ProgressBar pct={task.progressPct} color={task.projectColor} label={`${task.name} の進捗`} />
      <p className={card.delay > 0 ? "text-[13px] font-bold text-late-ink" : "text-[13px] text-ink-2"}>
        {card.delay > 0 ? `予定より 約${card.delay}日 遅れ` : `終了予定まで あと${formatWorkdays(card.remaining)}`}
      </p>
    </>
  );
}
