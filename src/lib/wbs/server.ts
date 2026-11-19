import "server-only";
// WBS の読み込みと、R3（並列禁止）の判定に使う「担当者の全プロジェクトのタスク」の読み込み。
import { and, asc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { projectMembers, projects, tasks, user, wbsNodes } from "@/db/schema";
import type { IsoDate } from "@/lib/calendar";
import { findOverlaps, suggestNextFreeStart } from "@/lib/rules";
import { workdaysBetween } from "@/lib/calendar";

export type WbsTask = {
  id: string;
  phaseId: string;
  name: string;
  deliverable: string;
  assigneeId: string;
  assigneeName: string;
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
  progressPct: number;
  sortOrder: number;
};

export type WbsNode = { id: string; parentId: string | null; level: "goal" | "phase"; name: string; sortOrder: number };

export type WbsMember = { userId: string; name: string };

/** プロジェクトの目的・フェーズ・タスク・メンバー */
export async function loadWbs(projectId: string) {
  const [nodes, taskRows, members] = await Promise.all([
    db
      .select({
        id: wbsNodes.id,
        parentId: wbsNodes.parentId,
        level: wbsNodes.level,
        name: wbsNodes.name,
        sortOrder: wbsNodes.sortOrder,
      })
      .from(wbsNodes)
      .where(eq(wbsNodes.projectId, projectId))
      .orderBy(asc(wbsNodes.sortOrder), asc(wbsNodes.createdAt)),
    db
      .select({
        id: tasks.id,
        phaseId: tasks.phaseId,
        name: tasks.name,
        deliverable: tasks.deliverable,
        assigneeId: tasks.assigneeId,
        assigneeName: user.name,
        plannedStart: tasks.plannedStart,
        plannedEnd: tasks.plannedEnd,
        progressPct: tasks.progressPct,
        sortOrder: tasks.sortOrder,
      })
      .from(tasks)
      .innerJoin(user, eq(user.id, tasks.assigneeId))
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.sortOrder), asc(tasks.plannedStart), asc(tasks.createdAt)),
    db
      .select({ userId: user.id, name: user.name })
      .from(projectMembers)
      .innerJoin(user, eq(user.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(asc(projectMembers.createdAt)),
  ]);
  return { nodes: nodes as WbsNode[], tasks: taskRows as WbsTask[], members: members as WbsMember[] };
}

export type ConflictCard = {
  taskId: string;
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
  /** 見る人がそのプロジェクトのメンバーでなければ null（「別プロジェクトの予定」と出す） */
  projectName: string | null;
  projectColor: string | null;
  projectIcon: string | null;
  taskName: string | null;
  progressPct: number | null;
};

/**
 * 担当者の全プロジェクトのタスク（R3 はプロジェクトをまたいで判定する）。
 * viewerId がメンバーでないプロジェクトのタスクは、名前などを伏せる（§6）。
 */
export async function assigneeSchedule(assigneeId: string, viewerId: string) {
  const viewer = alias(projectMembers, "viewer");
  const rows = await db
    .select({
      id: tasks.id,
      assigneeId: tasks.assigneeId,
      plannedStart: tasks.plannedStart,
      plannedEnd: tasks.plannedEnd,
      name: tasks.name,
      progressPct: tasks.progressPct,
      projectName: projects.name,
      projectColor: projects.color,
      projectIcon: projects.icon,
      visible: sql<boolean>`${viewer.userId} is not null`,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(viewer, and(eq(viewer.projectId, tasks.projectId), eq(viewer.userId, viewerId)))
    .where(eq(tasks.assigneeId, assigneeId));
  return rows;
}

export type OverlapCheck = {
  conflicts: ConflictCard[];
  /** 同じ稼働日数で置ける、次の空き開始日（衝突がなければ null） */
  suggestedStart: IsoDate | null;
};

/** 候補の期間が、担当者のほかのタスクと重なっていないか（R3）。重なっていれば次の空き日も出す */
export async function checkOverlaps(input: {
  assigneeId: string;
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
  excludeTaskId?: string | null;
  viewerId: string;
}): Promise<OverlapCheck> {
  const schedule = await assigneeSchedule(input.assigneeId, input.viewerId);
  const conflicts = findOverlaps(
    { id: input.excludeTaskId, assigneeId: input.assigneeId, plannedStart: input.plannedStart, plannedEnd: input.plannedEnd },
    schedule,
  );
  if (conflicts.length === 0) return { conflicts: [], suggestedStart: null };
  const duration = Math.max(1, workdaysBetween(input.plannedStart, input.plannedEnd));
  return {
    conflicts: conflicts.map((c) => ({
      taskId: c.id,
      plannedStart: c.plannedStart,
      plannedEnd: c.plannedEnd,
      projectName: c.visible ? c.projectName : null,
      projectColor: c.visible ? c.projectColor : null,
      projectIcon: c.visible ? c.projectIcon : null,
      taskName: c.visible ? c.name : null,
      progressPct: c.visible ? c.progressPct : null,
    })),
    suggestedStart: suggestNextFreeStart(
      input.assigneeId,
      schedule,
      input.plannedStart,
      duration,
      input.excludeTaskId,
    ),
  };
}

/** 同じ親の中での並び順の最大値 + 1（新しいものを末尾に置く） */
export async function nextNodeSortOrder(projectId: string, parentId: string | null): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${wbsNodes.sortOrder}), -1)` })
    .from(wbsNodes)
    .where(
      and(
        eq(wbsNodes.projectId, projectId),
        parentId === null ? sql`${wbsNodes.parentId} is null` : eq(wbsNodes.parentId, parentId),
      ),
    );
  return Number(row?.max ?? -1) + 1;
}

export async function nextTaskSortOrder(phaseId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${tasks.sortOrder}), -1)` })
    .from(tasks)
    .where(eq(tasks.phaseId, phaseId));
  return Number(row?.max ?? -1) + 1;
}

