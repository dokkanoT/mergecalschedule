import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { progressSnapshots, tasks, user, wbsNodes } from "@/db/schema";
import type { IsoDate } from "@/lib/calendar";

export type GanttTask = {
  id: string;
  phaseId: string;
  name: string;
  deliverable: string;
  assigneeName: string;
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
  actualStart: IsoDate | null;
  actualEnd: IsoDate | null;
  progressPct: number;
};

/**
 * ガントに出す WBS とタスク。statusDate が今日より前で、その日の進捗スナップショット（週次レポート出力時に保存）があれば、
 * その日の進捗率を使う（過去のイナズマ線を再現する）。今日以降・スナップショットなしなら、いまの進捗率。
 */
export async function loadGantt(projectId: string, statusDate: IsoDate, today: IsoDate) {
  const useSnapshot = statusDate < today;
  const [nodes, taskRows, snapshots] = await Promise.all([
    db
      .select({ id: wbsNodes.id, parentId: wbsNodes.parentId, level: wbsNodes.level, name: wbsNodes.name })
      .from(wbsNodes)
      .where(eq(wbsNodes.projectId, projectId))
      .orderBy(asc(wbsNodes.sortOrder), asc(wbsNodes.createdAt)),
    db
      .select({
        id: tasks.id,
        phaseId: tasks.phaseId,
        name: tasks.name,
        deliverable: tasks.deliverable,
        assigneeName: user.name,
        plannedStart: tasks.plannedStart,
        plannedEnd: tasks.plannedEnd,
        actualStart: tasks.actualStart,
        actualEnd: tasks.actualEnd,
        progressPct: tasks.progressPct,
      })
      .from(tasks)
      .innerJoin(user, eq(user.id, tasks.assigneeId))
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.sortOrder), asc(tasks.plannedStart), asc(tasks.createdAt)),
    useSnapshot
      ? db
          .select({ taskId: progressSnapshots.taskId, progressPct: progressSnapshots.progressPct })
          .from(progressSnapshots)
          .where(and(eq(progressSnapshots.projectId, projectId), eq(progressSnapshots.statusDate, statusDate)))
      : Promise.resolve([]),
  ]);
  const snapshot = new Map(snapshots.map((s) => [s.taskId, s.progressPct]));
  return {
    nodes,
    tasks: taskRows.map((t) => ({ ...t, progressPct: snapshot.get(t.id) ?? t.progressPct })) as GanttTask[],
    fromSnapshot: snapshots.length > 0,
  };
}
