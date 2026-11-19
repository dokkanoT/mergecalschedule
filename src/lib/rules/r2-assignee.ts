// R2：1タスクの担当者は1人。「全員」は作らず、「メンバー分複製」で人数分のタスクに分ける
import type { RuleIssue } from "./types";

export function validateAssignee(assigneeId: string | null | undefined): RuleIssue[] {
  return (assigneeId ?? "").trim() === ""
    ? [{ field: "assigneeId", message: "担当者を1人選んでください。" }]
    : [];
}

/**
 * 「メンバー分複製」：同じ内容のタスクを、選んだメンバーの人数分つくる。
 * 各タスクの担当者は1人ずつ。できたタスクはそれぞれ R3 を個別に満たす必要がある。
 */
export function duplicateForMembers<T extends { assigneeId: string }>(
  draft: Omit<T, "assigneeId">,
  memberIds: readonly string[],
): T[] {
  const unique = [...new Set(memberIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) {
    throw new RangeError("複製するメンバーを1人以上選んでください。");
  }
  return unique.map((assigneeId) => ({ ...draft, assigneeId }) as T);
}
