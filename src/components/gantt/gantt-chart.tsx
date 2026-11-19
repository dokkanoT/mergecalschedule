import { ProgressBar } from "@/components/common/progress-bar";
import { type IsoDate, isoWeekday } from "@/lib/calendar";
import {
  barOf,
  COLUMN_WIDTH,
  columnOf,
  describeLightning,
  type GanttNode,
  ganttDays,
  ganttRows,
  lightningVertices,
  ROW_HEIGHT,
} from "@/lib/gantt";
import type { GanttTask } from "@/lib/gantt/server";
import { dayHeaderLabel, formatMonthDay } from "@/lib/format";
import { tintOf } from "@/lib/project-style";
import { bufferPeriod } from "@/lib/rules";
import { cn } from "@/lib/utils";

const LEFT_WIDTH = 360;
const HEADER_HEIGHT = 56;

type Props = {
  project: { color: string; deadline: IsoDate; bufferDays: number };
  nodes: GanttNode[];
  tasks: GanttTask[];
  range: { start: IsoDate; end: IsoDate };
  statusDate: IsoDate;
};

/** ガントチャート（表示専用）。左に WBS、右に1日1列の日付グリッド、上にイナズマ線の SVG を重ねる */
export function GanttChart({ project, nodes, tasks, range, statusDate }: Props) {
  const days = ganttDays(range.start, range.end);
  const rows = ganttRows(nodes, tasks);
  const gridWidth = days.length * COLUMN_WIDTH;
  const bodyHeight = rows.length * ROW_HEIGHT;
  const buffer = bufferPeriod(project.deadline, project.bufferDays);
  const bufferBar = barOf(range.start, buffer.start, project.deadline);
  const deadlineX = (columnOf(range.start, project.deadline) + 1) * COLUMN_WIDTH;
  const statusCol = columnOf(range.start, statusDate);
  const vertices = lightningVertices(rows, statusDate, range.start);
  const tint = tintOf(project.color) ?? "#EDEEF1";
  const path = vertices.map((v, i) => `${i === 0 ? "M" : "L"}${v.x},${v.y}`).join(" ");
  const label = describeLightning(tasks, statusDate);

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <div className="relative" style={{ width: LEFT_WIDTH + gridWidth }}>
        {/* 見出し */}
        <div className="flex border-b border-border" style={{ height: HEADER_HEIGHT }}>
          <div
            className="left-0 z-20 flex shrink-0 items-end md:sticky gap-2 border-r border-border bg-surface px-4 pb-2 text-[12px] font-bold text-muted-foreground"
            style={{ width: LEFT_WIDTH }}
          >
            <span className="flex-1">WBS</span>
            <span className="w-20">担当</span>
            <span className="w-24">進捗</span>
          </div>
          <div className="flex" style={{ width: gridWidth }}>
            {days.map((d, i) => (
              <div
                key={d.date}
                className={cn(
                  "flex shrink-0 flex-col items-center justify-end pb-1.5 text-[11px] leading-tight",
                  d.offday ? "bg-offday-head text-muted-foreground" : "text-ink-2",
                  i === statusCol && "bg-primary-soft font-bold text-primary-soft-ink",
                  isoWeekday(d.date) === 1 && "border-l border-border",
                )}
                style={{ width: COLUMN_WIDTH }}
                title={d.holiday ?? undefined}
              >
                {(i === 0 || d.date.endsWith("-01") || isoWeekday(d.date) === 1) && (
                  <span className="text-[11px] text-muted-foreground">{formatMonthDay(d.date).split("/")[0]}月</span>
                )}
                <span className="font-bold">{Number(d.date.slice(8))}</span>
                <span>{dayHeaderLabel(d.date)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 本体 */}
        <div className="flex">
          <div className="left-0 z-20 shrink-0 border-r md:sticky border-border bg-surface" style={{ width: LEFT_WIDTH }}>
            {rows.map((row) => (
              <div
                key={`${row.kind}-${row.id}`}
                className={cn(
                  "flex items-center gap-2 border-b border-divider px-4 text-[13px]",
                  row.kind === "phase" && "bg-phase-row font-bold text-ink",
                )}
                style={{ height: ROW_HEIGHT }}
              >
                {row.kind === "goal" && (
                  <span className="truncate font-heading text-[14px] font-bold text-ink">
                    <span className="mr-2 text-[11px] text-muted-foreground">目的</span>
                    {row.name}
                  </span>
                )}
                {row.kind === "phase" && <span className="truncate pl-2">{row.name}</span>}
                {row.kind === "task" && (
                  <>
                    <span className="min-w-0 flex-1 truncate pl-6 text-ink">{row.task.name}</span>
                    <span className="w-20 truncate text-ink-2">{row.task.assigneeName}</span>
                    <span className="w-24">
                      <ProgressBar pct={row.task.progressPct} color={project.color} label={`${row.task.name} の進捗`} />
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="relative" style={{ width: gridWidth, height: bodyHeight }}>
            {/* 土日祝・進捗管理日の列 */}
            {days.map((d, i) =>
              d.offday || i === statusCol ? (
                <div
                  key={d.date}
                  aria-hidden="true"
                  className={cn("absolute top-0 bottom-0", i === statusCol ? "bg-primary-soft" : "bg-offday")}
                  style={{ left: i * COLUMN_WIDTH, width: COLUMN_WIDTH }}
                />
              ) : null,
            )}
            {/* 予備期間（斜線）と締切日の縦線 */}
            <div
              aria-hidden="true"
              className="gantt-buffer absolute top-0 bottom-0"
              style={{ left: bufferBar.left, width: bufferBar.width }}
            />
            <div aria-hidden="true" className="absolute top-0 bottom-0 w-0.5 bg-late-ink" style={{ left: deadlineX - 1 }} />
            {/* 行の区切り */}
            {rows.map((row, i) => (
              <div
                key={`line-${row.kind}-${row.id}`}
                aria-hidden="true"
                className={cn("absolute right-0 left-0 border-b border-divider", row.kind === "phase" && "bg-phase-row/60")}
                style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
              />
            ))}
            {/* バー：予定（tint の上に進捗分を色で）と実績（細い線） */}
            {rows.map((row, i) => {
              if (row.kind !== "task") return null;
              const t = row.task;
              const planned = barOf(range.start, t.plannedStart, t.plannedEnd);
              const actualEnd = t.actualEnd ?? (t.actualStart ? (statusDate > t.actualStart ? statusDate : t.actualStart) : null);
              const actual = t.actualStart && actualEnd ? barOf(range.start, t.actualStart, actualEnd) : null;
              return (
                <div key={`bar-${t.id}`}>
                  <div
                    className="absolute overflow-hidden rounded-[11px]"
                    style={{ left: planned.left + 2, width: planned.width - 4, top: i * ROW_HEIGHT + 7, height: 22, backgroundColor: tint }}
                    title={`${t.name}：予定 ${formatMonthDay(t.plannedStart)}〜${formatMonthDay(t.plannedEnd)}・進捗 ${t.progressPct}%`}
                  >
                    <div className="h-full" style={{ width: `${t.progressPct}%`, backgroundColor: project.color }} />
                  </div>
                  {actual && (
                    <div
                      className="absolute rounded-full bg-ink-2"
                      style={{ left: actual.left + 2, width: actual.width - 4, top: i * ROW_HEIGHT + 35, height: 5 }}
                      title={`${t.name}：実績 ${formatMonthDay(t.actualStart!)}〜${t.actualEnd ? formatMonthDay(t.actualEnd) : "作業中"}`}
                    />
                  )}
                </div>
              );
            })}
            {/* イナズマ線と進捗管理日の縦線 */}
            {rows.length > 0 && (
              <svg
                role="img"
                aria-label={label}
                className="pointer-events-none absolute top-0 left-0"
                width={gridWidth}
                height={bodyHeight}
              >
                <line
                  x1={(statusCol + 1) * COLUMN_WIDTH}
                  x2={(statusCol + 1) * COLUMN_WIDTH}
                  y1={0}
                  y2={bodyHeight}
                  stroke="var(--color-primary)"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
                <path d={path} fill="none" stroke="var(--color-lightning)" strokeWidth={2.5} strokeLinejoin="round" />
                {vertices.map((v, i) =>
                  v.status === "line" ? null : (
                    <circle key={i} cx={v.x} cy={v.y} r={4} fill="var(--color-lightning)" />
                  ),
                )}
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
