import "server-only";
// 招待の読み込みと受諾（DB 操作）。判定は src/lib/invitations の純粋関数を使う。
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invitations, projectMembers, projects, user } from "@/db/schema";
import { invitationState } from "./index";

export async function findInvitationByToken(token: string) {
  const [row] = await db
    .select({
      invitation: invitations,
      project: { id: projects.id, name: projects.name, color: projects.color, icon: projects.icon },
      inviterName: user.name,
    })
    .from(invitations)
    .innerJoin(projects, eq(projects.id, invitations.projectId))
    .leftJoin(user, eq(user.id, invitations.invitedBy))
    .where(eq(invitations.token, token))
    .limit(1);
  if (!row) return null;
  return { ...row, state: invitationState(row.invitation, new Date()) };
}

export type FoundInvitation = NonNullable<Awaited<ReturnType<typeof findInvitationByToken>>>;

/**
 * 招待を受けてメンバーにする。すでにメンバーなら役割は変えない。
 * 同時に2回押されても、受諾済みにできるのは1回だけ（accepted_at が null の行だけ更新する）。
 */
export async function acceptInvitation(invitationId: string, projectId: string, userId: string, role: "owner" | "member") {
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(and(eq(invitations.id, invitationId), isNull(invitations.acceptedAt)))
      .returning({ id: invitations.id });
    if (updated.length === 0) return;
    await tx.insert(projectMembers).values({ projectId, userId, role }).onConflictDoNothing();
  });
}

export async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return row !== undefined;
}

export async function userExistsWithEmail(email: string): Promise<boolean> {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  return row !== undefined;
}
