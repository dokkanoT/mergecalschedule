"use server";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { projectMembers, tasks, user, wbsNodes } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth/permissions";
import { type IsoDate, isIsoDate } from "@/lib/calendar";
import {
  isParallelTaskViolation,
  PARALLEL_TASK_MESSAGE,
  type RuleIssue,
  validateAssignee,
  validateDeliverable,
  validateTaskDates,
  validateTaskName,
} from "@/lib/rules";
import { type MoveDirection, moveInOrder } from "@/lib/wbs";
import { checkOverlaps, nextNodeSortOrder, nextTaskSortOrder, type OverlapCheck } from "@/lib/wbs/server";

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/board");
}

// ---------------------------------------------------------------------------
// 目的・フェーズ
// ---------------------------------------------------------------------------

export type SimpleResult = { error?: string };

/** 目的・フェーズを作る／名前を変える（owner だけ）。フェーズの親は同じプロジェクトの目的に限る */
export async function saveNode(
  projectId: string,
  input: { id?: string; level: "goal" | "phase"; parentId?: string | null; name: string },
): Promise<SimpleResult> {
  await requireProjectOwner(projectId);
  const name = input.name.trim();
  if (name === "") return { error: input.level === "goal" ? "目的を入力してください。" : "フェーズ名を入力してください。" };

  if (input.id) {
    await db
      .update(wbsNodes)
      .set({ name })
      .where(and(eq(wbsNodes.id, input.id), eq(wbsNodes.projectId, projectId)));
  } else {
    let parentId: string | null = null;
    if (input.level === "phase") {
      const [parent] = await db
        .select({ id: wbsNodes.id })
        .from(wbsNodes)
        .where(and(eq(wbsNodes.id, input.parentId ?? ""), eq(wbsNodes.projectId, projectId), eq(wbsNodes.level, "goal")));
      if (!parent) return { error: "フェーズを入れる目的が見つかりません。画面を読み込み直してください。" };
      parentId = parent.id;
    }
    await db.insert(wbsNodes).values({
      projectId,
      parentId,
      level: input.level,
      name,
      sortOrder: await nextNodeSortOrder(projectId, parentId),
    });
  }
  revalidate(projectId);
  return {};
}

/** 目的・フェーズを消す（owner だけ）。配下のフェーズ・タスクもまとめて消える */
export async function deleteNode(projectId: string, nodeId: string): Promise<SimpleResult> {
  await requireProjectOwner(projectId);
  await db.delete(wbsNodes).where(and(eq(wbsNodes.id, nodeId), eq(wbsNodes.projectId, projectId)));
  revalidate(projectId);
  return {};
}

/** 目的・フェーズを同じ親の中で1つ上か下へ（owner だけ） */
export async function moveNode(projectId: string, nodeId: string, direction: MoveDirection): Promise<SimpleResult> {
  await requireProjectOwner(projectId);
  const [node] = await db
    .select({ parentId: wbsNodes.parentId })
    .from(wbsNodes)
    .where(and(eq(wbsNodes.id, nodeId), eq(wbsNodes.projectId, projectId)));
  if (!node) return { error: "見つかりません。画面を読み込み直してください。" };
  const siblings = await db
    .select({ id: wbsNodes.id })
    .from(wbsNodes)
    .where(
      and(
        eq(wbsNodes.projectId, projectId),
        node.parentId === null ? sql`${wbsNodes.parentId} is null` : eq(wbsNodes.parentId, node.parentId),
      ),
    )
    .orderBy(asc(wbsNodes.sortOrder), asc(wbsNodes.createdAt));
  const order = moveInOrder(
    siblings.map((s) => s.id),
    nodeId,
    direction,
  );
  if (!order) return {};
  await db.transaction(async (tx) => {
    for (const [i, id] of order.entries()) {
      await tx.update(wbsNodes).set({ sortOrder: i }).where(eq(wbsNodes.id, id));
    }
  });
  revalidate(projectId);
  return {};
}

// ---------------------------------------------------------------------------
// タスク
// ---------------------------------------------------------------------------

export type TaskFormInput = {
  id?: string | null;
  phaseId: string;
  name: string;
  deliverable: string;
  assigneeId: string;
  plannedStart: string;
  plannedEnd: string;
};

export type TaskSaveResult = {
  ok?: boolean;
  errors?: Partial<Record<"name" | "deliverable" | "assigneeId" | "plannedStart" | "plannedEnd" | "phaseId", string>>;
  formError?: string;
  /** 並列禁止（R3）に引っかかったときの衝突先と、次の空き日 */
  overlap?: OverlapCheck;
};

function toErrors(issues: readonly RuleIssue[]): TaskSaveResult["errors"] {
  const errors: NonNullable<TaskSaveResult["errors"]> = {};
  for (const i of issues) {
    const k = i.field as keyof typeof errors;
    errors[k] ??= i.message;
  }
  return errors;
}

/** R0〜R2 の入力チェックと、フェーズ・担当者がこのプロジェクトのものかの確認 */
async function validateTaskInput(projectId: string, input: TaskFormInput): Promise<TaskSaveResult | null> {
  const issues = [
    ...validateTaskName(input.name),
    ...validateDeliverable(input.deliverable),
    ...validateAssignee(input.assigneeId),
    ...validateTaskDates({ plannedStart: input.plannedStart, plannedEnd: input.plannedEnd }),
  ];
  if (issues.length > 0) return { errors: toErrors(issues) };

  const [phase] = await db
    .select({ id: wbsNodes.id })
    .from(wbsNodes)
    .where(and(eq(wbsNodes.id, input.phaseId), eq(wbsNodes.projectId, projectId), eq(wbsNodes.level, "phase")));
  if (!phase) return { errors: { phaseId: "フェーズが見つかりません。画面を読み込み直してください。" } };

  const [member] = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, input.assigneeId)));
  if (!member) return { errors: { assigneeId: "担当者はこのプロジェクトのメンバーから選んでください。" } };
  return null;
}

/** 入力中の並列禁止チェック（R3）。画面から呼ぶ。保存時もサーバーで同じ判定をする */
export async function checkTaskSchedule(
  projectId: string,
  input: { assigneeId: string; plannedStart: string; plannedEnd: string; excludeTaskId?: string | null },
): Promise<OverlapCheck | null> {
  const { user: me } = await requireProjectOwner(projectId);
  if (!input.assigneeId || !isIsoDate(input.plannedStart) || !isIsoDate(input.plannedEnd)) return null;
  if (input.plannedStart > input.plannedEnd) return null;
  return checkOverlaps({ ...input, plannedStart: input.plannedStart as IsoDate, plannedEnd: input.plannedEnd as IsoDate, viewerId: me.id });
}

/** タスクを作る／直す（owner だけ）。R0〜R3 をサーバーでも判定し、DB の排他制約違反も日本語にする */
export async function saveTask(projectId: string, input: TaskFormInput): Promise<TaskSaveResult> {
  const { user: me } = await requireProjectOwner(projectId);
  const invalid = await validateTaskInput(projectId, input);
  if (invalid) return invalid;

  const overlap = await checkOverlaps({
    assigneeId: input.assigneeId,
    plannedStart: input.plannedStart,
    plannedEnd: input.plannedEnd,
    excludeTaskId: input.id,
    viewerId: me.id,
  });
  if (overlap.conflicts.length > 0) return { errors: { plannedStart: PARALLEL_TASK_MESSAGE }, overlap };

  const values = {
    phaseId: input.phaseId,
    name: input.name.trim(),
    deliverable: input.deliverable.trim(),
    assigneeId: input.assigneeId,
    plannedStart: input.plannedStart,
    plannedEnd: input.plannedEnd,
  };
  try {
    if (input.id) {
      const updated = await db
        .update(tasks)
        .set(values)
        .where(and(eq(tasks.id, input.id), eq(tasks.projectId, projectId)))
        .returning({ id: tasks.id });
      if (updated.length === 0) return { formError: "タスクが見つかりません。画面を読み込み直してください。" };
    } else {
      await db.insert(tasks).values({ ...values, projectId, sortOrder: await nextTaskSortOrder(input.phaseId) });
    }
  } catch (e) {
    if (isParallelTaskViolation(e)) return { errors: { plannedStart: PARALLEL_TASK_MESSAGE } };
    console.error("saveTask", e);
    return { formError: "保存できませんでした。もう一度試してください。" };
  }
  revalidate(projectId);
  return { ok: true };
}

export type DuplicateResult = TaskSaveResult & {
  /** 期間が重なって作れなかったメンバーの名前 */
  conflictedMembers?: string[];
};

/**
 * 「メンバー分複製」（R2）：同じ内容のタスクを、選んだメンバーの人数分つくる（owner だけ）。
 * どれか1人でも期間が重なれば、1件も作らない（R3 は1件ずつ満たす必要がある）。
 */
export async function duplicateTaskForMembers(
  projectId: string,
  input: Omit<TaskFormInput, "id" | "assigneeId">,
  memberIds: string[],
): Promise<DuplicateResult> {
  const { user: me } = await requireProjectOwner(projectId);
  const unique = [...new Set(memberIds)].filter(Boolean);
  if (unique.length === 0) return { errors: { assigneeId: "複製するメンバーを1人以上選んでください。" } };

  for (const assigneeId of unique) {
    const invalid = await validateTaskInput(projectId, { ...input, assigneeId });
    if (invalid) return invalid;
  }
  const conflicted: string[] = [];
  for (const assigneeId of unique) {
    const o = await checkOverlaps({ assigneeId, plannedStart: input.plannedStart, plannedEnd: input.plannedEnd, viewerId: me.id });
    if (o.conflicts.length > 0) conflicted.push(assigneeId);
  }
  if (conflicted.length > 0) {
    const names = await db.select({ name: user.name }).from(user).where(inArray(user.id, conflicted));
    return {
      errors: { plannedStart: `${names.map((n) => n.name).join("・")} さんは、この期間に別のタスクを持っています。` },
      conflictedMembers: names.map((n) => n.name),
    };
  }

  try {
    await db.transaction(async (tx) => {
      let sortOrder = await nextTaskSortOrder(input.phaseId);
      for (const assigneeId of unique) {
        await tx.insert(tasks).values({
          projectId,
          phaseId: input.phaseId,
          name: input.name.trim(),
          deliverable: input.deliverable.trim(),
          assigneeId,
          plannedStart: input.plannedStart,
          plannedEnd: input.plannedEnd,
          sortOrder: sortOrder++,
        });
      }
    });
  } catch (e) {
    if (isParallelTaskViolation(e)) return { errors: { plannedStart: PARALLEL_TASK_MESSAGE } };
    console.error("duplicateTaskForMembers", e);
    return { formError: "保存できませんでした。もう一度試してください。" };
  }
  revalidate(projectId);
  return { ok: true };
}

export async function deleteTask(projectId: string, taskId: string): Promise<SimpleResult> {
  await requireProjectOwner(projectId);
  await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));
  revalidate(projectId);
  return {};
}

/** タスクをフェーズの中で1つ上か下へ（owner だけ） */
export async function moveTask(projectId: string, taskId: string, direction: MoveDirection): Promise<SimpleResult> {
  await requireProjectOwner(projectId);
  const [task] = await db
    .select({ phaseId: tasks.phaseId })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));
  if (!task) return { error: "見つかりません。画面を読み込み直してください。" };
  const siblings = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.phaseId, task.phaseId))
    .orderBy(asc(tasks.sortOrder), asc(tasks.plannedStart), asc(tasks.createdAt));
  const order = moveInOrder(
    siblings.map((s) => s.id),
    taskId,
    direction,
  );
  if (!order) return {};
  await db.transaction(async (tx) => {
    for (const [i, id] of order.entries()) {
      await tx.update(tasks).set({ sortOrder: i }).where(eq(tasks.id, id));
    }
  });
  revalidate(projectId);
  return {};
}
