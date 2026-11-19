"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { type ProgressUpdateField, type ProgressUpdateInput, validateProgressUpdate } from "@/lib/board";
import { type IsoDate, isIsoDate, todayInTokyo } from "@/lib/calendar";

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
