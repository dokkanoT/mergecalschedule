import "server-only";
// プロジェクトの権限チェック（CLAUDE.md §6）。必ずサーバー側で呼ぶ。UI の非表示だけに頼らない。
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { projectMembers, projects } from "@/db/schema";
import type { ProjectRole } from "@/lib/invitations";
import { requireUser } from "./index";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 画面から来た id が UUID の形か（形が違うと DB がエラーを返すので、先に弾く） */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export type Project = typeof projects.$inferSelect;

/** userId がメンバーのプロジェクトと役割。メンバーでなければ null */
export async function findProjectForUser(
  projectId: string,
  userId: string,
): Promise<{ project: Project; role: ProjectRole } | null> {
  if (!UUID_PATTERN.test(projectId)) return null;
  const [row] = await db
    .select({ project: projects, role: projectMembers.role })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(and(eq(projects.id, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** プロジェクトのメンバーだけが通れる。メンバーでなければ 404（プロジェクトがあることも知らせない） */
export async function requireProjectMember(projectId: string) {
  const user = await requireUser();
  const found = await findProjectForUser(projectId, user.id);
  if (!found) notFound();
  return { user, ...found };
}

/** プロジェクトの owner だけが通れる。owner でなければ 404 */
export async function requireProjectOwner(projectId: string) {
  const ctx = await requireProjectMember(projectId);
  if (ctx.role !== "owner") notFound();
  return ctx;
}

/** 自分がメンバーのプロジェクト一覧（締切の近い順） */
export async function listMyProjects(userId: string) {
  return db
    .select({ project: projects, role: projectMembers.role })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId))
    .orderBy(asc(projects.deadline), asc(projects.name));
}
