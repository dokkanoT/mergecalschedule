import "server-only";
// 進捗レポート（PDF）。@react-pdf/renderer で作る（CLAUDE.md §7）。
// 1ページ目：概要と R4 警告 / 2ページ目〜：イナズマ線付きガント / 最後：遅れタスクと未解決の困りごと
import { Circle, Document, Line, Page, Polyline, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Project } from "@/lib/auth/permissions";
import type { IsoDate } from "@/lib/calendar";
import { dayHeaderLabel, formatDateTime, formatDateWithWeekday, formatPeriod, formatWorkdays } from "@/lib/format";
import { barOf, columnOf, type GanttNode, ganttDays, ganttRange, ganttRows, lightningVertices } from "@/lib/gantt";
import type { GanttTask } from "@/lib/gantt/server";
import { tintOf } from "@/lib/project-style";
import { PDF_FONT_FAMILY, registerPdfFonts } from "./pdf-fonts";
import { chunkRows, fitColumnWidth, reportSummary } from "./report-summary";

// A4 横（pt）
const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 28;
const LEFT_W = 210; // ガントの左（WBS・担当・進捗）
const ROW_H = 17;
const HEAD_H = 22; // ガントの日付見出し
const ROWS_PER_PAGE = Math.floor((PAGE_H - MARGIN * 2 - 70 - HEAD_H) / ROW_H);

const C = {
  ink: "#18181B",
  ink2: "#3F434D",
  muted: "#5B5F6A",
  border: "#E6E7EB",
  divider: "#F0F1F3",
  offday: "#F1F2F4",
  offdayHead: "#E9EAEE",
  phaseRow: "#FAFAFB",
  primary: "#4F46E5",
  primarySoft: "#EEF0FF",
  lightning: "#D92D20",
  okBg: "#EAF1FF",
  okInk: "#1D4ED8",
  lateBg: "#FFF1E6",
  lateInk: "#9A3412",
  helpBg: "#FDECEC",
  helpInk: "#9F1D24",
  helpBody: "#7F1D1D",
  buffer: "#FDE3D2",
};

const s = StyleSheet.create({
  page: { padding: MARGIN, paddingBottom: MARGIN + 12, fontFamily: PDF_FONT_FAMILY, fontSize: 9, color: C.ink },
  eyebrow: { fontSize: 9, color: C.muted, marginBottom: 2 },
  h1: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  h2: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  footer: { position: "absolute", bottom: 16, left: MARGIN, right: MARGIN, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: C.muted },
  statRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  stat: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12 },
  statLabel: { fontSize: 9, color: C.muted, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: 700 },
  statNote: { fontSize: 8, color: C.muted, marginTop: 3 },
  alert: { marginTop: 16, borderRadius: 10, padding: 12 },
  table: { borderWidth: 1, borderColor: C.border, borderRadius: 8 },
  th: { flexDirection: "row", backgroundColor: C.phaseRow, borderBottomWidth: 1, borderBottomColor: C.border, fontWeight: 700, color: C.ink2 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.divider },
  td: { paddingVertical: 5, paddingHorizontal: 6 },
});

type Help = { id: string; body: string; createdAt: Date; taskName: string; posterName: string };

function Footer({ project, statusDate }: { project: Project; statusDate: IsoDate }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        マジスケ · {project.name} · 進捗管理日 {formatDateWithWeekday(statusDate)}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export async function buildProgressReportPdf(input: {
  project: Project;
  statusDate: IsoDate;
  today: IsoDate;
  nodes: readonly GanttNode[];
  tasks: readonly GanttTask[];
  helps: readonly Help[];
}): Promise<Uint8Array> {
  registerPdfFonts();
  const { project, statusDate, today, nodes, tasks, helps } = input;
  const summary = reportSummary(project, tasks, statusDate);
  const range = ganttRange({ tasks, deadline: project.deadline, statusDate });
  const days = ganttDays(range.start, range.end);
  const colW = fitColumnWidth(PAGE_W - MARGIN * 2 - LEFT_W, days.length);
  const gridW = colW * days.length;
  const rows = ganttRows(nodes, tasks);
  const vertices = lightningVertices(rows, statusDate, range.start, { columnWidth: colW, rowHeight: ROW_H });
  const pages = chunkRows(
    rows.map((row, i) => ({ row, vertex: vertices[i]! })),
    ROWS_PER_PAGE,
  );
  const tint = tintOf(project.color) ?? C.offday;
  const buffer = summary.buffer.period;
  const bufferBar = barOf(range.start, buffer.start, buffer.end, colW);
  const deadlineX = (columnOf(range.start, project.deadline) + 1) * colW;
  const statusCol = columnOf(range.start, statusDate);
  const statusX = (statusCol + 1) * colW;
  const warning = summary.buffer.status === "warning" ? summary.buffer : null;

  const doc = (
    <Document title={`${project.name} 進捗レポート ${statusDate}`} author="マジスケ" language="ja">
      {/* 1ページ目：概要 */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.eyebrow}>進捗レポート</Text>
        <Text style={s.h1}>{project.name}</Text>
        <Text style={{ color: C.ink2 }}>
          進捗管理日 {formatDateWithWeekday(statusDate)}　·　締切 {formatDateWithWeekday(project.deadline, statusDate)}　·　予備期間{" "}
          {formatPeriod(buffer.start, buffer.end)}（{formatWorkdays(project.bufferDays)}）
        </Text>

        <View style={s.statRow}>
          <View style={s.stat}>
            <Text style={s.statLabel}>全体の進捗</Text>
            <Text style={s.statValue}>{summary.overallPct}%</Text>
            <Text style={s.statNote}>予定では {summary.expectedOverallPct}%（予定日数で重み付け）</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>締切まで</Text>
            <Text style={s.statValue}>{formatWorkdays(summary.workdaysToDeadline)}</Text>
            <Text style={s.statNote}>締切 {formatDateWithWeekday(project.deadline, statusDate)}（土日祝を除く）</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>バッファ残</Text>
            <Text style={[s.statValue, warning ? { color: C.lateInk } : {}]}>
              {summary.bufferLeft === null ? "—" : formatWorkdays(summary.bufferLeft)}
            </Text>
            <Text style={s.statNote}>確保したい予備 {formatWorkdays(project.bufferDays)}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>遅れ・困りごと</Text>
            <Text style={s.statValue}>
              {summary.lateTasks.length}件 / {helps.length}件
            </Text>
            <Text style={s.statNote}>遅れているタスク / 未解決の困りごと</Text>
          </View>
        </View>

        {warning ? (
          <View style={[s.alert, { backgroundColor: C.helpBg }]}>
            <Text style={{ fontWeight: 700, color: C.helpInk, fontSize: 11 }}>
              予備が {formatWorkdays(warning.overrunWorkdays)} 足りません
            </Text>
            <Text style={{ color: C.helpBody, marginTop: 4 }}>
              最終タスクの予定終了日が予備期間（{formatPeriod(buffer.start, buffer.end)}）に入っています。締切日に完成する計画にならないよう、タスクを前に詰めるか、範囲を減らしてください。
            </Text>
          </View>
        ) : summary.buffer.status === "ok" ? (
          <View style={[s.alert, { backgroundColor: C.okBg }]}>
            <Text style={{ fontWeight: 700, color: C.okInk }}>予備期間を確保できています</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 18 }}>
          <Text style={{ color: C.muted, fontSize: 8 }}>
            ・日数はすべて稼働日（土日・祝日を除く）で数えています。・遅れは「進捗管理日までに終わっているはずの割合」より進捗率が低いタスクです。
          </Text>
          <Text style={{ color: C.muted, fontSize: 8, marginTop: 2 }}>
            ・次のページのイナズマ線は、進捗管理日の縦線より左に曲がっているタスクが遅れ、右が先行です。
          </Text>
        </View>
        <Footer project={project} statusDate={statusDate} />
      </Page>

      {/* 2ページ目〜：イナズマ線付きガント */}
      {pages.map((chunk, pageIndex) => {
        const bodyH = Math.max(chunk.length, 1) * ROW_H;
        const yOffset = pageIndex * ROWS_PER_PAGE * ROW_H;
        const points = chunk.map(({ vertex }) => `${vertex.x},${vertex.y - yOffset}`).join(" ");
        return (
          <Page key={pageIndex} size="A4" orientation="landscape" style={s.page}>
            <Text style={s.h2}>
              ガントチャートとイナズマ線{pages.length > 1 ? `（${pageIndex + 1}/${pages.length}）` : ""}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8, fontSize: 7, color: C.ink2 }}>
              {(
                [
                  [tint, "予定"],
                  [project.color, "進捗"],
                  [C.offday, "土日祝"],
                  [C.buffer, "予備期間"],
                  [C.lightning, "締切（縦線）・イナズマ線"],
                  [C.primary, "進捗管理日（破線）"],
                ] as const
              ).map(([color, label]) => (
                <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <View style={{ width: 12, height: 6, borderRadius: 2, backgroundColor: color }} />
                  <Text>{label}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", borderWidth: 1, borderColor: C.border }}>
              {/* 左：WBS */}
              <View style={{ width: LEFT_W, borderRightWidth: 1, borderRightColor: C.border }}>
                <View style={{ height: HEAD_H, flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 4, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: C.border, fontSize: 7, fontWeight: 700, color: C.muted }}>
                  <Text style={{ flex: 1 }}>WBS</Text>
                  <Text style={{ width: 46 }}>担当</Text>
                  <Text style={{ width: 26, textAlign: "right" }}>進捗</Text>
                </View>
                {chunk.map(({ row }) => (
                  <View
                    key={row.id}
                    style={{
                      height: ROW_H,
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 4,
                      fontSize: row.kind === "task" ? 7 : 7.5,
                      backgroundColor: row.kind === "phase" ? C.phaseRow : undefined,
                      borderBottomWidth: 0.5,
                      borderBottomColor: C.divider,
                    }}
                  >
                    {row.kind === "task" ? (
                      <>
                        <Text style={{ flex: 1, paddingLeft: 14, maxLines: 1 }}>{row.task.name}</Text>
                        <Text style={{ width: 46, color: C.ink2, maxLines: 1 }}>{row.task.assigneeName}</Text>
                        <Text style={{ width: 26, textAlign: "right" }}>{row.task.progressPct}%</Text>
                      </>
                    ) : (
                      <Text style={{ flex: 1, fontWeight: 700, paddingLeft: row.kind === "phase" ? 7 : 0, maxLines: 1 }}>
                        {row.kind === "goal" ? `目的：${row.name}` : row.name}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
              {/* 右：日付グリッド */}
              <View style={{ width: gridW }}>
                <View style={{ height: HEAD_H, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border }}>
                  {days.map((d, i) => (
                    <View
                      key={d.date}
                      style={{
                        width: colW,
                        alignItems: "center",
                        justifyContent: "flex-end",
                        paddingBottom: 2,
                        fontSize: colW < 9 ? 4.5 : 5.5,
                        color: d.offday ? C.muted : C.ink2,
                        backgroundColor: i === statusCol ? C.primarySoft : d.offday ? C.offdayHead : undefined,
                      }}
                    >
                      <Text>{i === 0 || d.date.endsWith("-01") ? `${Number(d.date.slice(5, 7))}/` : ""}</Text>
                      <Text style={{ fontWeight: 700 }}>{Number(d.date.slice(8))}</Text>
                      <Text>{dayHeaderLabel(d.date)}</Text>
                    </View>
                  ))}
                </View>
                <Svg width={gridW} height={bodyH}>
                  {days.map((d, i) =>
                    d.offday ? <Rect key={d.date} x={i * colW} y={0} width={colW} height={bodyH} fill={C.offday} /> : null,
                  )}
                  <Rect x={bufferBar.left} y={0} width={bufferBar.width} height={bodyH} fill={C.buffer} fillOpacity={0.6} />
                  {chunk.map(({ row }, r) => {
                    const y = r * ROW_H;
                    const line = <Line key={`l-${row.id}`} x1={0} y1={y + ROW_H} x2={gridW} y2={y + ROW_H} stroke={C.divider} strokeWidth={0.5} />;
                    if (row.kind !== "task") return line;
                    const t = row.task;
                    const bar = barOf(range.start, t.plannedStart, t.plannedEnd, colW);
                    return [
                      line,
                      <Rect key={`p-${row.id}`} x={bar.left} y={y + 4} width={bar.width} height={ROW_H - 8} rx={3} fill={tint} />,
                      <Rect
                        key={`g-${row.id}`}
                        x={bar.left}
                        y={y + 4}
                        width={(bar.width * t.progressPct) / 100}
                        height={ROW_H - 8}
                        rx={3}
                        fill={project.color}
                      />,
                    ];
                  })}
                  <Line x1={deadlineX} y1={0} x2={deadlineX} y2={bodyH} stroke={C.lightning} strokeWidth={1.2} />
                  <Line x1={statusX} y1={0} x2={statusX} y2={bodyH} stroke={C.primary} strokeWidth={0.8} strokeDasharray="3,2" />
                  {chunk.length > 1 && <Polyline points={points} fill="none" stroke={C.lightning} strokeWidth={1.4} />}
                  {chunk.map(({ row, vertex }) =>
                    vertex.status === "line" ? null : (
                      <Circle key={`v-${row.id}`} cx={vertex.x} cy={vertex.y - yOffset} r={1.8} fill={C.lightning} />
                    ),
                  )}
                </Svg>
              </View>
            </View>
            {rows.length === 0 && <Text style={{ marginTop: 8, color: C.muted }}>タスクはまだありません。</Text>}
            <Footer project={project} statusDate={statusDate} />
          </Page>
        );
      })}

      {/* 最後：遅れタスクと困りごと */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.h2}>遅れているタスク（{summary.lateTasks.length}件）</Text>
        {summary.lateTasks.length === 0 ? (
          <Text style={{ color: C.ink2, marginBottom: 16 }}>遅れているタスクはありません。</Text>
        ) : (
          <View style={[s.table, { marginBottom: 18 }]}>
            <View style={s.th}>
              <Text style={[s.td, { flex: 3 }]}>タスク</Text>
              <Text style={[s.td, { flex: 1.3 }]}>担当</Text>
              <Text style={[s.td, { flex: 1.6 }]}>予定</Text>
              <Text style={[s.td, { flex: 1, textAlign: "right" }]}>進捗</Text>
              <Text style={[s.td, { flex: 1.2, textAlign: "right" }]}>あるべき進捗</Text>
              <Text style={[s.td, { flex: 1.2, textAlign: "right" }]}>遅れ</Text>
            </View>
            {summary.lateTasks.map(({ task, expectedPct, delay }) => (
              <View key={task.id} style={s.tr} wrap={false}>
                <Text style={[s.td, { flex: 3 }]}>{task.name}</Text>
                <Text style={[s.td, { flex: 1.3 }]}>{task.assigneeName}</Text>
                <Text style={[s.td, { flex: 1.6 }]}>{formatPeriod(task.plannedStart, task.plannedEnd)}</Text>
                <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{task.progressPct}%</Text>
                <Text style={[s.td, { flex: 1.2, textAlign: "right" }]}>{expectedPct}%</Text>
                <Text style={[s.td, { flex: 1.2, textAlign: "right", color: C.lateInk, fontWeight: 700 }]}>約{delay}日</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.h2}>未解決の困りごと（{helps.length}件）</Text>
        {helps.length === 0 ? (
          <Text style={{ color: C.ink2 }}>未解決の困りごとはありません。</Text>
        ) : (
          <View style={s.table}>
            <View style={s.th}>
              <Text style={[s.td, { flex: 2 }]}>タスク</Text>
              <Text style={[s.td, { flex: 1.2 }]}>出した人</Text>
              <Text style={[s.td, { flex: 1.5 }]}>日時</Text>
              <Text style={[s.td, { flex: 5 }]}>内容</Text>
            </View>
            {helps.map((h) => (
              <View key={h.id} style={s.tr} wrap={false}>
                <Text style={[s.td, { flex: 2 }]}>{h.taskName}</Text>
                <Text style={[s.td, { flex: 1.2 }]}>{h.posterName}</Text>
                <Text style={[s.td, { flex: 1.5 }]}>{formatDateTime(h.createdAt, today)}</Text>
                <Text style={[s.td, { flex: 5, color: C.helpBody }]}>{h.body}</Text>
              </View>
            ))}
          </View>
        )}
        <Footer project={project} statusDate={statusDate} />
      </Page>
    </Document>
  );

  return new Uint8Array(await renderToBuffer(doc));
}
