import "server-only";
// 工程表（xlsx）を ExcelJS で作る。左に WBS、右に1日1列のガント（CLAUDE.md §7）。
// 塗り分けの判定は schedule-sheet.ts の純粋関数。
import ExcelJS from "exceljs";
import type { Project } from "@/lib/auth/permissions";
import type { IsoDate } from "@/lib/calendar";
import { dayHeaderLabel, formatDateWithWeekday, formatPeriod, formatWorkdays } from "@/lib/format";
import { type GanttNode, ganttDays, ganttRange, ganttRows } from "@/lib/gantt";
import type { GanttTask } from "@/lib/gantt/server";
import { tintOf } from "@/lib/project-style";
import { checkBuffer, lastPlannedEndOf } from "@/lib/rules";
import { SCHEDULE_COLUMNS, type ScheduleCellKind, scheduleBuffer, scheduleCellKind, toArgb } from "./schedule-sheet";

// docs/SCREENS.md のトークンと同じ色
const COLOR = {
  ink: "#18181B",
  muted: "#5B5F6A",
  border: "#E6E7EB",
  offdayHead: "#E9EAEE",
  offday: "#F1F2F4",
  phaseRow: "#FAFAFB",
  primarySoft: "#EEF0FF",
  buffer: "#F07B3F",
  deadline: "#D92D20",
  warnInk: "#9A3412",
} as const;

const HEADER_ROW = 4; // 見出しは 4・5 行目（日付と曜日）
const FIRST_DATA_ROW = 6;
const FIRST_DAY_COL = SCHEDULE_COLUMNS.length + 1;

const solid = (hex: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: toArgb(hex) } });
const thin = (hex: string): Partial<ExcelJS.Border> => ({ style: "thin", color: { argb: toArgb(hex) } });

/**
 * 折り返しを含む行の高さ（ポイント）。全角 1 文字 ≒ 列幅 2 として行数を見積もる。
 * cells は [文字列, 列幅] の組。
 */
function rowHeightFor(cells: [string, number][]): number {
  const lines = Math.max(
    1,
    ...cells.map(([text, width]) => {
      const units = [...text].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 0xff ? 2 : 1), 0);
      return Math.ceil(units / Math.max(1, width - 1));
    }),
  );
  return Math.max(20, lines * 15 + 6);
}

export async function buildScheduleXlsx(input: {
  project: Project;
  statusDate: IsoDate;
  nodes: readonly GanttNode[];
  tasks: readonly GanttTask[];
}): Promise<Uint8Array> {
  const { project, statusDate, nodes, tasks } = input;
  const range = ganttRange({ tasks, deadline: project.deadline, statusDate });
  const days = ganttDays(range.start, range.end);
  const rows = ganttRows(nodes, tasks);
  const buffer = scheduleBuffer(project);
  const bufferCheck = checkBuffer(project.deadline, project.bufferDays, lastPlannedEndOf(tasks));
  const tint = tintOf(project.color) ?? COLOR.offday;
  const lastCol = FIRST_DAY_COL + days.length - 1;
  const lastRow = FIRST_DATA_ROW + Math.max(rows.length, 1) - 1;

  const wb = new ExcelJS.Workbook();
  wb.creator = "マジスケ";
  wb.created = new Date();
  const ws = wb.addWorksheet("工程表", {
    views: [{ state: "frozen", xSplit: SCHEDULE_COLUMNS.length, ySplit: FIRST_DATA_ROW - 1 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    properties: { defaultRowHeight: 20 },
  });

  // 列幅：目的 / フェーズ / タスク / 成果物 / 担当 / 予定開始 / 予定終了 / 進捗率、日付は細く
  [16, 16, 24, 28, 12, 12, 12, 8].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  for (let c = FIRST_DAY_COL; c <= lastCol; c++) ws.getColumn(c).width = 4.5;

  // 1〜2 行目：タイトルと概要
  const title = ws.getCell(1, 1);
  title.value = `${project.name} 工程表`;
  title.font = { size: 16, bold: true, color: { argb: toArgb(COLOR.ink) } };
  const summary = [
    `進捗管理日：${formatDateWithWeekday(statusDate)}`,
    `締切：${formatDateWithWeekday(project.deadline, statusDate)}`,
    `予備期間：${formatPeriod(buffer.start, buffer.end)}（${formatWorkdays(project.bufferDays)}）`,
  ].join("　");
  ws.getCell(2, 1).value = summary;
  ws.getCell(2, 1).font = { color: { argb: toArgb(COLOR.muted) } };
  if (bufferCheck.status === "warning") {
    const warn = ws.getCell(2, 5);
    warn.value = `予備が ${formatWorkdays(bufferCheck.overrunWorkdays)} 足りません（最終タスクが予備期間に入っています）`;
    warn.font = { bold: true, color: { argb: toArgb(COLOR.warnInk) } };
  }

  // 3 行目：凡例（日付の列の上）
  const legend: [string, ExcelJS.Fill][] = [
    ["予定", solid(tint)],
    ["進捗", solid(project.color)],
    ["土日祝", solid(COLOR.offday)],
    ["予備期間", { type: "pattern", pattern: "lightUp", fgColor: { argb: toArgb(COLOR.buffer) } }],
  ];
  legend.forEach(([label, fill], i) => {
    const col = FIRST_DAY_COL + i * 4;
    ws.getCell(3, col).fill = fill;
    const text = ws.getCell(3, col + 1);
    text.value = label;
    text.font = { size: 9, color: { argb: toArgb(COLOR.muted) } };
  });

  // 4・5 行目：見出し
  SCHEDULE_COLUMNS.forEach((label, i) => {
    ws.mergeCells(HEADER_ROW, i + 1, HEADER_ROW + 1, i + 1);
    const cell = ws.getCell(HEADER_ROW, i + 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = solid(COLOR.phaseRow);
  });
  days.forEach((day, i) => {
    const col = FIRST_DAY_COL + i;
    const [, m, d] = day.date.split("-").map(Number);
    const dateCell = ws.getCell(HEADER_ROW, col);
    dateCell.value = d === 1 || i === 0 ? `${m}/${d}` : String(d);
    const weekdayCell = ws.getCell(HEADER_ROW + 1, col);
    weekdayCell.value = dayHeaderLabel(day.date);
    for (const cell of [dateCell, weekdayCell]) {
      cell.alignment = { horizontal: "center", vertical: "middle", shrinkToFit: true };
      cell.font = { size: 9, bold: day.date === statusDate };
      cell.fill = solid(day.date === statusDate ? COLOR.primarySoft : day.offday ? COLOR.offdayHead : COLOR.phaseRow);
    }
  });

  // 6 行目〜：目的・フェーズ・タスク
  rows.forEach((row, i) => {
    const r = FIRST_DATA_ROW + i;
    const excelRow = ws.getRow(r);
    if (row.kind === "goal") {
      excelRow.getCell(1).value = row.name;
      excelRow.getCell(1).font = { bold: true, size: 12 };
    } else if (row.kind === "phase") {
      excelRow.getCell(2).value = row.name;
      excelRow.getCell(2).font = { bold: true };
      for (let c = 1; c <= SCHEDULE_COLUMNS.length; c++) excelRow.getCell(c).fill = solid(COLOR.phaseRow);
    } else {
      const t = row.task;
      excelRow.getCell(3).value = t.name;
      excelRow.getCell(4).value = t.deliverable;
      excelRow.getCell(5).value = t.assigneeName;
      excelRow.getCell(6).value = formatDateWithWeekday(t.plannedStart, statusDate);
      excelRow.getCell(7).value = formatDateWithWeekday(t.plannedEnd, statusDate);
      excelRow.getCell(8).value = t.progressPct / 100;
      excelRow.getCell(8).numFmt = "0%";
      for (const c of [3, 4]) excelRow.getCell(c).alignment = { wrapText: true, vertical: "middle" };
      // Excel は開いたときに行の高さを自動で直さないので、折り返す行数から高さを決める
      excelRow.height = rowHeightFor([
        [t.name, 24],
        [t.deliverable, 28],
      ]);
    }
    for (let c = 1; c <= SCHEDULE_COLUMNS.length; c++) {
      const cell = excelRow.getCell(c);
      cell.alignment = { ...cell.alignment, vertical: "middle" };
    }
    const task = row.kind === "task" ? row.task : null;
    days.forEach((day, j) => {
      const kind: ScheduleCellKind = scheduleCellKind(day.date, task, buffer);
      const cell = excelRow.getCell(FIRST_DAY_COL + j);
      if (kind === "progress") cell.fill = solid(project.color);
      else if (kind === "planned") cell.fill = solid(tint);
      else if (kind === "offday") cell.fill = solid(COLOR.offday);
      else if (kind === "buffer") cell.fill = { type: "pattern", pattern: "lightUp", fgColor: { argb: toArgb(COLOR.buffer) } };
    });
  });

  // 罫線：表全体に薄い線、締切日の右に赤い太線、進捗管理日の両側に線
  const deadlineCol = days.findIndex((d) => d.date === project.deadline);
  const statusCol = days.findIndex((d) => d.date === statusDate);
  for (let r = HEADER_ROW; r <= lastRow; r++) {
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(r, c);
      const border: Partial<ExcelJS.Borders> = {
        top: thin(COLOR.border),
        bottom: thin(COLOR.border),
        left: thin(COLOR.border),
        right: thin(COLOR.border),
      };
      if (deadlineCol >= 0 && c === FIRST_DAY_COL + deadlineCol) {
        border.right = { style: "medium", color: { argb: toArgb(COLOR.deadline) } };
      }
      if (statusCol >= 0 && c === FIRST_DAY_COL + statusCol) {
        border.left = { style: "dashed", color: { argb: toArgb("#4F46E5") } };
        border.right = border.right?.style === "medium" ? border.right : { style: "dashed", color: { argb: toArgb("#4F46E5") } };
      }
      cell.border = border;
    }
  }
  if (rows.length === 0) ws.getCell(FIRST_DATA_ROW, 1).value = "タスクはまだありません";

  const out = await wb.xlsx.writeBuffer();
  return new Uint8Array(out as ArrayBuffer);
}
