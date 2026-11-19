// R1：タスクはスコープ（成果物）単位。完了には成果物の URL かメモが必要
import type { RuleIssue } from "./types";

/** 入力欄のプレースホルダ例（授業資料の例） */
export const DELIVERABLE_EXAMPLES = [
  "メイン画面の XML ファイル",
  "JSON 取得とリスト表示ができるサンプルアプリ",
  "テスト結果報告書",
] as const;

const isBlank = (value: string | null | undefined) => (value ?? "").trim() === "";

export function validateTaskName(name: string | null | undefined): RuleIssue[] {
  return isBlank(name) ? [{ field: "name", message: "タスク名を入力してください。" }] : [];
}

export function validateDeliverable(deliverable: string | null | undefined): RuleIssue[] {
  return isBlank(deliverable)
    ? [
        {
          field: "deliverable",
          message: `成果物を入力してください（例：「${DELIVERABLE_EXAMPLES[0]}」）。タスクは成果物の単位で作ります。`,
        },
      ]
    : [];
}

export type CompletionInput = {
  progressPct: number;
  deliverableUrl?: string | null;
  completionNote?: string | null;
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** 進捗率（0〜100 の整数）、成果物 URL の形式、完了時の URL またはメモを確かめる */
export function validateCompletion(input: CompletionInput): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const { progressPct, deliverableUrl, completionNote } = input;

  if (!Number.isInteger(progressPct) || progressPct < 0 || progressPct > 100) {
    issues.push({ field: "progressPct", message: "進捗率は 0〜100 の整数で入力してください。" });
  }
  if (!isBlank(deliverableUrl) && !isHttpUrl(deliverableUrl!.trim())) {
    issues.push({ field: "deliverableUrl", message: "成果物の URL は http:// か https:// で始めてください。" });
  }
  if (progressPct === 100 && isBlank(deliverableUrl) && isBlank(completionNote)) {
    issues.push({
      field: "deliverableUrl",
      message: "完了（100%）にするには、成果物の URL かメモを入力してください。",
    });
  }
  return issues;
}
