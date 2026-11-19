// WBS ルール（R0〜R5）の判定。UI・Server Action・テストのすべてからここを呼ぶ（判定を画面ごとに書き直さない）。
import type { CompletionInput } from "./r1-deliverable";
import { validateCompletion, validateDeliverable, validateTaskName } from "./r1-deliverable";
import { validateAssignee } from "./r2-assignee";
import { type TaskDatesInput, validateTaskDates } from "./task-dates";
import type { RuleIssue } from "./types";

export * from "./project";
export * from "./r1-deliverable";
export * from "./r2-assignee";
export * from "./r3-no-parallel";
export * from "./r4-buffer";
export * from "./r5-meeting";
export * from "./task-dates";
export type { RuleIssue } from "./types";

export type TaskInput = TaskDatesInput &
  CompletionInput & {
    name: string;
    deliverable: string;
    assigneeId: string | null;
  };

/**
 * タスク1件の入力チェック（R0・R1・R2）。R3（重なり）は他のタスクが要るので findOverlaps で別に判定する。
 */
export function validateTask(input: TaskInput): RuleIssue[] {
  return [
    ...validateTaskName(input.name),
    ...validateDeliverable(input.deliverable),
    ...validateAssignee(input.assigneeId),
    ...validateTaskDates(input),
    ...validateCompletion(input),
  ];
}
