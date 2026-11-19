// R5：会議体（週次の進捗共有）。進捗共有日と、出力ファイル名のテンプレート。
// ファイル名の記号の意味はアプリ側で解釈・検証しない（チーム固有の記号を含めてよい）。
import { addDays, type IsoDate, isIsoDate, weekEndDate } from "@/lib/calendar";
import type { RuleIssue } from "./types";

export const DEFAULT_WEEK_END_WEEKDAY = 5;
export const DEFAULT_XLSX_FILE_NAME_TEMPLATE = "{yyMMdd}_{project}工程表v{n}.xlsx";
export const DEFAULT_PDF_FILE_NAME_TEMPLATE = "{yyMMdd}_{project}進捗レポート.pdf";

/** テンプレートで使える変数 */
export const FILE_NAME_VARIABLES = ["{yyMMdd}", "{project}", "{n}"] as const;

/** date が進捗共有日か（その週の最終日。祝日なら直前の稼働日） */
export function isStatusDay(date: IsoDate, weekEndWeekday = DEFAULT_WEEK_END_WEEKDAY): boolean {
  return weekEndDate(date, weekEndWeekday) === date;
}

/** from〜to（両端含む）にある進捗共有日の一覧 */
export function statusDaysBetween(
  from: IsoDate,
  to: IsoDate,
  weekEndWeekday = DEFAULT_WEEK_END_WEEKDAY,
): IsoDate[] {
  const days: IsoDate[] = [];
  // 週ごとに1日。from の週の月曜から 7 日ずつ進める
  for (let d = weekEndDate(from, weekEndWeekday); d <= to; d = weekEndDate(addDays(d, 7), weekEndWeekday)) {
    if (d >= from) days.push(d);
  }
  return days;
}

/** "2026-11-27" → "261127" */
export function formatYyMMdd(date: IsoDate): string {
  if (!isIsoDate(date)) throw new RangeError(`日付の形式が正しくありません: ${date}`);
  return date.slice(2).replaceAll("-", "");
}

/** ファイル名に使えない文字（/ \ : * ? " < > |）と制御文字を _ に置き換える */
export function sanitizeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, "_");
}

export type FileNameContext = {
  statusDate: IsoDate;
  projectName: string;
  /** 同じプロジェクトでの、その種類の出力回数（1 から） */
  n: number;
};

/**
 * テンプレートからファイル名を作る。拡張子がなければ付ける。
 * 例：{yyMMdd}b_{project}工程表v{n}.xlsx → 261127b_minebook工程表v1.xlsx
 */
export function renderFileName(template: string, kind: "xlsx" | "pdf", ctx: FileNameContext): string {
  const rendered = template
    .replaceAll("{yyMMdd}", formatYyMMdd(ctx.statusDate))
    .replaceAll("{project}", ctx.projectName)
    .replaceAll("{n}", String(ctx.n));
  const name = sanitizeFileName(rendered.trim());
  const ext = `.${kind}`;
  return name.toLowerCase().endsWith(ext) ? name : `${name}${ext}`;
}

export function validateFileNameTemplate(template: string | null | undefined, field: string): RuleIssue[] {
  return (template ?? "").trim() === ""
    ? [{ field, message: "ファイル名のテンプレートを入力してください。" }]
    : [];
}

/** 未解決の困りごとの件数（resolvedAt が null のもの） */
export function countOpenHelpRequests(requests: readonly { resolvedAt: Date | string | null }[]): number {
  return requests.filter((r) => r.resolvedAt === null).length;
}
