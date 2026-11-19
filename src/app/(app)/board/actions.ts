"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { helpRequests, tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { findProjectForUser, isUuid } from "@/lib/auth/permissions";
import { type ProgressUpdateField, type ProgressUpdateInput, validateProgressUpdate } from "@/lib/board";
import { type IsoDate, isIsoDate, todayInTokyo } from "@/lib/calendar";
import { validateHelpBody } from "@/lib/rules";

export type ProgressUpdateResult = {
  ok?: boolean;
  errors?: Partial<Record<ProgressUpdateField, string>>;
  formError?: string;
};

type RawInput = {
  progressPct: number;
  actualStart: string;
  actualEnd: string;
  deliverableUrl: string;
  completionNote: string;
};

const blankToNull = (value: string) => (value.trim() === "" ? null : value.trim());

/**
 * 自分が担当のタスクの進捗率・実績日・成果物 URL・メモを更新する（§6：member が直せるのはここだけ）。
 * 担当者の確認はサーバーで行う。予定日・タスク名などは変えない。
 */
export async function updateMyProgress(taskId: string, raw: RawInput): Promise<ProgressUpdateResult> {
  const me = await requireUser();
  if (!isUuid(taskId)) return { formError: "このタスクは更新できません。担当しているタスクだけ更新できます。" };
  const [task] = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      assigneeId: tasks.assigneeId,
      plannedStart: tasks.plannedStart,
      plannedEnd: tasks.plannedEnd,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  if (!task || task.assigneeId !== me.id) {
    return { formError: "このタスクは更新できません。担当しているタスクだけ更新できます。" };
  }

  const actualStart = blankToNull(raw.actualStart);
  const actualEnd = blankToNull(raw.actualEnd);
  if ((actualStart && !isIsoDate(actualStart)) || (actualEnd && !isIsoDate(actualEnd))) {
    return { formError: "日付が正しくありません。" };
  }
  const input: ProgressUpdateInput = {
    progressPct: Number(raw.progressPct),
    actualStart: actualStart as IsoDate | null,
    actualEnd: actualEnd as IsoDate | null,
    deliverableUrl: blankToNull(raw.deliverableUrl),
    completionNote: blankToNull(raw.completionNote),
  };
  const errors = validateProgressUpdate(input, task, todayInTokyo());
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await db.update(tasks).set(input).where(eq(tasks.id, task.id));
  } catch (e) {
    console.error("updateMyProgress", e);
    return { formError: "保存できませんでした。もう一度試してください。" };
  }
  revalidatePath("/board");
  revalidatePath(`/projects/${task.projectId}`, "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 困りごと（R5）
// ---------------------------------------------------------------------------

export type HelpResult = { ok?: boolean; error?: string };

/** 困りごとを出す。出せるのは、そのタスクの担当者だけ */
export async function postHelp(taskId: string, body: string): Promise<HelpResult> {
  const me = await requireUser();
  if (!isUuid(taskId)) return { error: "このタスクには困りごとを出せません。担当しているタスクを選んでください。" };
  const [task] = await db
    .select({ id: tasks.id, projectId: tasks.projectId, assigneeId: tasks.assigneeId })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  if (!task || task.assigneeId !== me.id) {
    return { error: "このタスクには困りごとを出せません。担当しているタスクを選んでください。" };
  }
  const issue = validateHelpBody(body)[0];
  if (issue) return { error: issue.message };

  try {
    await db.insert(helpRequests).values({ taskId: task.id, userId: me.id, body: body.trim() });
  } catch (e) {
    console.error("postHelp", e);
    return { error: "送れませんでした。もう一度試してください。" };
  }
  revalidatePath("/board");
  revalidatePath(`/projects/${task.projectId}`, "layout");
  return { ok: true };
}

/**
 * 「手を貸す」：困りごとを解決済みにする。押した人を解決者として記録する。
 * 押せるのは、そのタスクのプロジェクトのメンバー（担当者本人も含む）。
 */
export async function resolveHelp(helpId: string): Promise<HelpResult> {
  const me = await requireUser();
  if (!isUuid(helpId)) return { error: "この困りごとは見つかりません。画面を読み込み直してください。" };
  const [help] = await db
    .select({ id: helpRequests.id, projectId: tasks.projectId, resolvedAt: helpRequests.resolvedAt })
    .from(helpRequests)
    .innerJoin(tasks, eq(tasks.id, helpRequests.taskId))
    .where(eq(helpRequests.id, helpId));
  if (!help || !(await findProjectForUser(help.projectId, me.id))) {
    return { error: "この困りごとは見つかりません。画面を読み込み直してください。" };
  }

  const updated = await db
    .update(helpRequests)
    .set({ resolvedAt: new Date(), resolvedBy: me.id })
    .where(and(eq(helpRequests.id, help.id), isNull(helpRequests.resolvedAt)))
    .returning({ id: helpRequests.id });
  revalidatePath("/board");
  revalidatePath(`/projects/${help.projectId}`, "layout");
  if (updated.length === 0) return { error: "この困りごとは、もう解決済みです。" };
  return { ok: true };
}
