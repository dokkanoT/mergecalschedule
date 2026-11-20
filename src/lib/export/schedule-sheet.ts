// 工程表（xlsx）のレイアウトの計算。純粋関数（ExcelJS には触らない）。
// 授業資料の「カレーライスを作る」例に合わせて、左に WBS、右に1日1列のガントを置く（CLAUDE.md §7）。
import { type IsoDate, isWorkday, workdaysBetween } from "@/lib/calendar";
import { type BufferPeriod, bufferPeriod } from "@/lib/rules";
import { lightningOffset, type PlannedTask } from "@/lib/progress";

/** 左側の WBS の列（この右に日付の列が続く） */
export const SCHEDULE_COLUMNS = ["目的", "フェーズ", "タスク", "成果物", "担当", "予定開始", "予定終了", "進捗率"] as const;

/**
 * 日付のマスの塗り分け。
 * - progress：予定期間のうち、進捗率の分（濃いプロジェクト色）
 * - planned：予定期間の残り（薄いプロジェクト色）
 * - offday：土日祝（グレー。予定期間の中でも稼働日ではないので灰色）
 * - buffer：予備期間（締切 − バッファ〜締切）
 * - null：塗らない
 */
export type ScheduleCellKind = "progress" | "planned" | "offday" | "buffer" | null;

/**
 * 予定期間の稼働日のうち、何日分を「進捗」で塗るか。
 * イナズマ線の点と同じ D × 進捗率 / 100 稼働日を四捨五入する（80% × 5日 = 4日）。
 */
export function progressCellCount(task: PlannedTask & { progressPct: number }): number {
  return Math.round(lightningOffset(task));
}

/** 1つのマスの塗り分け。task が null なら目的・フェーズの行 */
export function scheduleCellKind(
  date: IsoDate,
  task: (PlannedTask & { progressPct: number }) | null,
  buffer: BufferPeriod,
): ScheduleCellKind {
  if (!isWorkday(date)) return "offday";
  if (task && task.plannedStart <= date && date <= task.plannedEnd) {
    // 開始日からこの日までの稼働日数（この日を含む）が、進捗の日数以内なら進捗
    return workdaysBetween(task.plannedStart, date) <= progressCellCount(task) ? "progress" : "planned";
  }
  if (buffer.start <= date && date <= buffer.end) return "buffer";
  return null;
}

/** 予備期間（xlsx・PDF 共通の入口。締切とバッファは利用者の入力） */
export function scheduleBuffer(project: { deadline: IsoDate; bufferDays: number }): BufferPeriod {
  return bufferPeriod(project.deadline, project.bufferDays);
}

/** "#7C5CFA" → ExcelJS の ARGB "FF7C5CFA" */
export function toArgb(hex: string): string {
  const value = hex.replace("#", "").toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(value)) throw new RangeError(`色の形式が正しくありません: ${hex}`);
  return `FF${value}`;
}

/**
 * Content-Disposition（日本語のファイル名は filename* で送る。古いブラウザ用に ASCII の代わりの名前も付ける）
 */
export function contentDisposition(fileName: string): string {
  const ext = fileName.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const fallback = /[^_.]/.test(ascii.replace(ext, "")) ? ascii : `download${ext}`;
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
