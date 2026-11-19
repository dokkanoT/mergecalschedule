// プロジェクト設定の入力チェック（R4 の締切・バッファ、R5 の週の最終曜日・ファイル名テンプレート）
import { isIsoDate } from "@/lib/calendar";
import { isProjectColor, isProjectIcon } from "@/lib/project-style";
import { validateFileNameTemplate } from "./r5-meeting";
import type { RuleIssue } from "./types";

export type ProjectSettingsInput = {
  name: string;
  color: string;
  icon: string;
  deadline: string;
  bufferDays: number;
  weekEndWeekday: number;
  xlsxFileNameTemplate: string;
  pdfFileNameTemplate: string;
};

export function validateProjectSettings(input: ProjectSettingsInput): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (input.name.trim() === "") {
    issues.push({ field: "name", message: "プロジェクト名を入力してください。" });
  }
  if (!isProjectColor(input.color)) {
    issues.push({ field: "color", message: "色は 6 色の中から選んでください。" });
  }
  if (!isProjectIcon(input.icon)) {
    issues.push({ field: "icon", message: "アイコンは一覧の中から選んでください。" });
  }
  if (!isIsoDate(input.deadline)) {
    issues.push({ field: "deadline", message: "締切日を入力してください。" });
  }
  if (!Number.isInteger(input.bufferDays) || input.bufferDays < 1) {
    issues.push({ field: "bufferDays", message: "バッファ日数は 1 以上の整数で入力してください。" });
  }
  if (!Number.isInteger(input.weekEndWeekday) || input.weekEndWeekday < 1 || input.weekEndWeekday > 5) {
    issues.push({ field: "weekEndWeekday", message: "週の最終曜日は月〜金から選んでください。" });
  }
  issues.push(
    ...validateFileNameTemplate(input.xlsxFileNameTemplate, "xlsxFileNameTemplate"),
    ...validateFileNameTemplate(input.pdfFileNameTemplate, "pdfFileNameTemplate"),
  );
  return issues;
}
