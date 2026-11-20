import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { primaryButtonClass } from "@/components/common/buttons";
import { StatusPill } from "@/components/common/status-pill";
import { GanttChart } from "@/components/gantt/gantt-chart";
import { StatusDateSelect } from "@/components/gantt/status-date-select";
import { ProjectEyebrow } from "@/components/projects/project-eyebrow";
import { PageHeader } from "@/components/shell/page-header";
import { requireProjectMember } from "@/lib/auth/permissions";
import { isIsoDate, todayInTokyo } from "@/lib/calendar";
import { formatDateWithWeekday, formatMonthDay, formatWorkdays } from "@/lib/format";
import { ganttRange, latestSelectableStatusDate, statusDateOptions } from "@/lib/gantt";
import { loadGantt } from "@/lib/gantt/server";
import { tintOf } from "@/lib/project-style";
import { checkBuffer, lastPlannedEndOf } from "@/lib/rules";

export const metadata = { title: "ガントチャート | マジスケ" };

export default async function GanttPage({ params, searchParams }: PageProps<"/projects/[id]/gantt">) {
  const { id } = await params;
  const { date } = await searchParams;
  const { project, role } = await requireProjectMember(id);
  const today = todayInTokyo();
  const latest = latestSelectableStatusDate(today, project.weekEndWeekday);
  const statusDate = typeof date === "string" && isIsoDate(date) && date <= latest ? date : today;

  const { nodes, tasks, fromSnapshot } = await loadGantt(id, statusDate, today);
  const range = ganttRange({ tasks, deadline: project.deadline, statusDate });
  const options = statusDateOptions({ rangeStart: range.start, today, weekEndWeekday: project.weekEndWeekday });
  if (!options.some((o) => o.date === statusDate)) {
    options.push({ date: statusDate, label: formatDateWithWeekday(statusDate), isWeekEnd: false });
  }
  const lastEnd = lastPlannedEndOf(tasks);
  const buffer = checkBuffer(project.deadline, project.bufferDays, lastEnd);

  return (
    <>
      <PageHeader
        eyebrow={<ProjectEyebrow project={project} today={today} />}
        title="ガントチャート"
        actions={
          <>
            <StatusDateSelect value={statusDate} options={options} />
            {buffer.status === "warning" ? (
              <StatusPill status="late" label={`予備が ${formatWorkdays(buffer.overrunWorkdays)} 足りません`} />
            ) : buffer.status === "ok" && lastEnd ? (
              <StatusPill status="ok" label={`最終タスク ${formatMonthDay(lastEnd, today)} 終了 · 予備を確保`} />
            ) : null}
          </>
        }
      />

      <ul aria-label="凡例" className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-ink-2">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-6 rounded-full" style={{ backgroundColor: tintOf(project.color) ?? undefined }} />
          予定
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-6 rounded-full" style={{ backgroundColor: project.color }} />
          進捗
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-1.5 w-6 rounded-full bg-ink-2" />
          実績
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-0.5 w-6 bg-lightning" />
          イナズマ線
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-4 bg-offday-head" />
          土日祝
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="gantt-buffer h-3 w-6 border border-late-bg" />
          予備期間（締切 {formatMonthDay(project.deadline, today)}）
        </li>
      </ul>

      {tasks.length === 0 ? (
        <EmptyState
          action={
            role === "owner" && (
              <Link href={`/projects/${id}/wbs`} className={primaryButtonClass}>
                WBS を作る
              </Link>
            )
          }
        >
          まだタスクがありません。WBS にタスクを入れると、ここにガントチャートが出ます。
        </EmptyState>
      ) : (
        <>
          <GanttChart
            project={{ color: project.color, deadline: project.deadline, bufferDays: project.bufferDays }}
            nodes={nodes}
            tasks={tasks}
            range={range}
            statusDate={statusDate}
          />
          <p className="mt-3 text-[13px] text-ink-2">
            赤い線（イナズマ線）が左に曲がっているタスクは遅れ、右に曲がっているタスクは先行です。破線は進捗管理日（
            {formatDateWithWeekday(statusDate, today)}）。
            {fromSnapshot ? "この日の進捗率は、週次レポートを出力したときの記録です。" : ""}
          </p>
        </>
      )}
    </>
  );
}
