// プロジェクト設定フォームの値の読み取りと、フォームの状態の型（サーバー・画面の両方で使う）
import { addDays, type IsoDate, weekEndDate } from "@/lib/calendar";
import type { ProjectSettingsInput, RuleIssue } from "@/lib/rules";

export type ProjectFormValues = {
  name: string;
  color: string;
  icon: string;
  deadline: string;
  bufferDays: string;
  weekEndWeekday: string;
  xlsxFileNameTemplate: string;
  pdfFileNameTemplate: string;
};

export type ProjectFormState = {
  /** 項目ごとのエラー文 */
  errors: Partial<Record<keyof ProjectFormValues, string>>;
  /** 項目に結びつかないエラー（サーバーエラーなど） */
  formError?: string;
  /** 送った値（エラーのとき入力を残すため） */
  values?: ProjectFormValues;
  /** 保存できたときの時刻（トースト用） */
  savedAt?: number;
};

export function readProjectForm(form: FormData): ProjectFormValues {
  const get = (k: keyof ProjectFormValues) => String(form.get(k) ?? "");
  return {
    name: get("name"),
    color: get("color"),
    icon: get("icon"),
    deadline: get("deadline"),
    bufferDays: get("bufferDays"),
    weekEndWeekday: get("weekEndWeekday"),
    xlsxFileNameTemplate: get("xlsxFileNameTemplate"),
    pdfFileNameTemplate: get("pdfFileNameTemplate"),
  };
}

/** 文字列のままのフォームの値を、ルール判定に渡す形にする */
export function toProjectSettings(v: ProjectFormValues): ProjectSettingsInput {
  return {
    name: v.name.trim(),
    color: v.color,
    icon: v.icon,
    deadline: v.deadline,
    bufferDays: v.bufferDays.trim() === "" ? Number.NaN : Number(v.bufferDays),
    weekEndWeekday: Number(v.weekEndWeekday),
    xlsxFileNameTemplate: v.xlsxFileNameTemplate.trim(),
    pdfFileNameTemplate: v.pdfFileNameTemplate.trim(),
  };
}

export function issuesToErrors(issues: readonly RuleIssue[]): ProjectFormState["errors"] {
  const errors: ProjectFormState["errors"] = {};
  for (const issue of issues) {
    const field = issue.field as keyof ProjectFormValues;
    errors[field] ??= issue.message;
  }
  return errors;
}

/** today 以降で最初の進捗共有日（週の最終日） */
export function nextStatusDay(today: IsoDate, weekEndWeekday: number): IsoDate {
  const thisWeek = weekEndDate(today, weekEndWeekday);
  return thisWeek >= today ? thisWeek : weekEndDate(addDays(today, 7), weekEndWeekday);
}
