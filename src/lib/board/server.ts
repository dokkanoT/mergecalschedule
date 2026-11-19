import "server-only";
// メンバーボードの読み込み。見る人と同じプロジェクトにいるメンバーと、その人たちの全プロジェクトのタスク。
// 見る人がメンバーでないプロジェクトのタスクは、名前などをここで消してから画面に渡す（§6）。
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { helpRequests, projectMembers, projects, tasks, user } from "@/db/schema";
import type { IsoDate } from "@/lib/calendar";
import type { BoardMember, BoardTask } from "./index";

/** 自分のタスクだけに付ける、進捗更新用の項目 */
export type OwnTaskFields = {
  actualStart: IsoDate | null;
  actualEnd: IsoDate | null;
  deliverableUrl: string | null;
  completionNote: string | null;
};

export type LoadedBoardTask = BoardTask & { assigneeId: string; own: OwnTaskFields | null };

export async function loadBoard(viewerId: string) {
  const myProjects = await db
    .select({ id: projects.id, name: projects.name, color: projects.color, icon: projects.icon })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(eq(projectMembers.userId, viewerId))
    .orderBy(asc(projects.deadline), asc(projects.name));
  if (myProjects.length === 0) return { projects: myProjects, members: [] as BoardMember[], tasks: [] as LoadedBoardTask[] };

  const projectIds = myProjects.map((p) => p.id);
  const memberRows = await db
    .select({ userId: user.id, name: user.name, title: user.title, projectId: projectMembers.projectId })
    .from(projectMembers)
    .innerJoin(user, eq(user.id, projectMembers.userId))
    .where(inArray(projectMembers.projectId, projectIds));

  const membersById = new Map<string, BoardMember>();
  for (const row of memberRows) {
    const m = membersById.get(row.userId) ?? { userId: row.userId, name: row.name, title: row.title, projectIds: [] };
    m.projectIds.push(row.projectId);
    membersById.set(row.userId, m);
  }
  const memberIds = [...membersById.keys()];

  const viewer = alias(projectMembers, "viewer");
  const openHelp = db
    .select({ taskId: helpRequests.taskId, count: sql<number>`count(*)::int`.as("count") })
    .from(helpRequests)
    .where(isNull(helpRequests.resolvedAt))
    .groupBy(helpRequests.taskId)
    .as("open_help");

  const rows = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      assigneeId: tasks.assigneeId,
      name: tasks.name,
      deliverable: tasks.deliverable,
      plannedStart: tasks.plannedStart,
      plannedEnd: tasks.plannedEnd,
      actualStart: tasks.actualStart,
      actualEnd: tasks.actualEnd,
      progressPct: tasks.progressPct,
      deliverableUrl: tasks.deliverableUrl,
      completionNote: tasks.completionNote,
      projectName: projects.name,
      projectColor: projects.color,
      projectIcon: projects.icon,
      visible: sql<boolean>`${viewer.userId} is not null`,
      openHelpCount: sql<number>`coalesce(${openHelp.count}, 0)`,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(viewer, and(eq(viewer.projectId, tasks.projectId), eq(viewer.userId, viewerId)))
    .leftJoin(openHelp, eq(openHelp.taskId, tasks.id))
    .where(inArray(tasks.assigneeId, memberIds))
    .orderBy(asc(tasks.plannedStart));

  const boardTasks: LoadedBoardTask[] = rows.map((r) =>
    r.visible
      ? {
          id: r.id,
          projectId: r.projectId,
          assigneeId: r.assigneeId,
          projectName: r.projectName,
          projectColor: r.projectColor,
          projectIcon: r.projectIcon,
          name: r.name,
          deliverable: r.deliverable,
          plannedStart: r.plannedStart,
          plannedEnd: r.plannedEnd,
          progressPct: r.progressPct,
          visible: true,
          openHelpCount: Number(r.openHelpCount),
          own:
            r.assigneeId === viewerId
              ? {
                  actualStart: r.actualStart,
                  actualEnd: r.actualEnd,
                  deliverableUrl: r.deliverableUrl,
                  completionNote: r.completionNote,
                }
              : null,
        }
      : {
          // 別プロジェクトの予定：期間だけ残す
          id: r.id,
          projectId: "",
          assigneeId: r.assigneeId,
          projectName: "",
          projectColor: "",
          projectIcon: "",
          name: "",
          deliverable: "",
          plannedStart: r.plannedStart,
          plannedEnd: r.plannedEnd,
          progressPct: 0,
          visible: false,
          openHelpCount: 0,
          own: null,
        },
  );

  return { projects: myProjects, members: [...membersById.values()], tasks: boardTasks };
}
