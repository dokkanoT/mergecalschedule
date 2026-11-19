"use server";

import { randomBytes } from "node:crypto";
import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { invitations, projectMembers, tasks, user } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth/permissions";
import {
  invitationExpiresAt,
  normalizeEmail,
  type ProjectRole,
  validateInvitationInput,
} from "@/lib/invitations";
import { memberRemovalBlocker, roleChangeBlocker } from "@/lib/projects/members";

export type InviteFormState = {
  errors: { email?: string; role?: string };
  formError?: string;
  /** 作った招待の token（リンクを表示するため） */
  createdToken?: string;
  createdEmail?: string;
};

/** 招待を作る（owner だけ）。メールは送らない。リンクを owner が手で渡す */
export async function createInvitation(
  projectId: string,
  _prev: InviteFormState,
  form: FormData,
): Promise<InviteFormState> {
  const { user: me } = await requireProjectOwner(projectId);
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const role = String(form.get("role") ?? "member");
  const issues = validateInvitationInput({ email, role });
  if (issues.length > 0) {
    return { errors: Object.fromEntries(issues.map((i) => [i.field, i.message])) };
  }

  const [member] = await db
    .select({ id: user.id })
    .from(projectMembers)
    .innerJoin(user, eq(user.id, projectMembers.userId))
    .where(and(eq(projectMembers.projectId, projectId), eq(user.email, email)))
    .limit(1);
  if (member) return { errors: { email: "この人はすでにメンバーです。" } };

  const token = randomBytes(24).toString("base64url");
  try {
    await db.transaction(async (tx) => {
      // 同じ人への未受諾の招待は作り直す（古いリンクは使えなくなる）
      await tx
        .delete(invitations)
        .where(
          and(eq(invitations.projectId, projectId), eq(invitations.email, email), isNull(invitations.acceptedAt)),
        );
      await tx.insert(invitations).values({
        projectId,
        email,
        role: role as ProjectRole,
        token,
        invitedBy: me.id,
        expiresAt: invitationExpiresAt(new Date()),
      });
    });
  } catch (e) {
    console.error("createInvitation", e);
    return { errors: {}, formError: "招待を作れませんでした。もう一度試してください。" };
  }
  revalidatePath(`/projects/${projectId}/settings`);
  return { errors: {}, createdToken: token, createdEmail: email };
}

/** 未受諾の招待を取り消す（owner だけ） */
export async function revokeInvitation(projectId: string, invitationId: string): Promise<void> {
  await requireProjectOwner(projectId);
  await db
    .delete(invitations)
    .where(
      and(eq(invitations.id, invitationId), eq(invitations.projectId, projectId), isNull(invitations.acceptedAt)),
    );
  revalidatePath(`/projects/${projectId}/settings`);
}

export type MemberChangeResult = { error?: string };

/** 対象メンバーの役割と、プロジェクトのオーナー数。対象がメンバーでなければ null */
async function memberContext(projectId: string, userId: string) {
  const [target] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  if (!target) return null;
  const [owners] = await db
    .select({ n: count() })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, "owner")));
  return { targetRole: target.role, ownerCount: owners?.n ?? 0 };
}

/** メンバーの役割を変える（owner だけ）。最後の owner はメンバーにできない */
export async function changeMemberRole(
  projectId: string,
  userId: string,
  role: ProjectRole,
): Promise<MemberChangeResult> {
  const { user: me } = await requireProjectOwner(projectId);
  if (role !== "owner" && role !== "member") return { error: "役割が正しくありません。" };
  const ctx = await memberContext(projectId, userId);
  if (!ctx) return { error: "このメンバーはもういません。画面を読み込み直してください。" };
  const blocker = roleChangeBlocker({ ...ctx, isSelf: userId === me.id, nextRole: role });
  if (blocker) return { error: blocker };

  await db
    .update(projectMembers)
    .set({ role })
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  revalidatePath("/", "layout");
  return {};
}

/**
 * メンバーをプロジェクトから外す（owner だけ）。アカウントは消さない（ほかのプロジェクトに入っていることがある）。
 * 自分自身・最後の owner・担当タスクがある人は外せない。
 */
export async function removeMember(projectId: string, userId: string): Promise<MemberChangeResult> {
  const { user: me } = await requireProjectOwner(projectId);
  const ctx = await memberContext(projectId, userId);
  if (!ctx) return { error: "このメンバーはもういません。画面を読み込み直してください。" };
  const [assigned] = await db
    .select({ n: count() })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.assigneeId, userId)));
  const blocker = memberRemovalBlocker({
    ...ctx,
    isSelf: userId === me.id,
    assignedTaskCount: assigned?.n ?? 0,
  });
  if (blocker) return { error: blocker };

  try {
    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  } catch (e) {
    // 判定のあとにタスクが割り当てられた場合は、DB の外部キー（23503）で止まる
    console.error("removeMember", e);
    return { error: "外せませんでした。担当しているタスクがないか確かめてください。" };
  }
  revalidatePath("/", "layout");
  return {};
}
