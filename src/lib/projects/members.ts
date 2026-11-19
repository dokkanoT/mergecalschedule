// メンバーを外す・役割を変えるときの判定（純粋関数）。DB の件数を受け取って、だめな理由を返す。
import type { ProjectRole } from "@/lib/invitations";

export type MemberChangeContext = {
  /** 対象メンバーのいまの役割 */
  targetRole: ProjectRole;
  /** プロジェクトのオーナーの人数（対象を含む） */
  ownerCount: number;
  /** 対象が操作している本人か */
  isSelf: boolean;
};

/** オーナーが1人もいなくなる変更か */
function leavesNoOwner(ctx: MemberChangeContext): boolean {
  return ctx.targetRole === "owner" && ctx.ownerCount <= 1;
}

/** メンバーを外せない理由。外せるなら null */
export function memberRemovalBlocker(ctx: MemberChangeContext & { assignedTaskCount: number }): string | null {
  if (ctx.isSelf) return "自分自身は外せません。別のオーナーに外してもらってください。";
  if (leavesNoOwner(ctx)) return "オーナーが1人もいなくなるため外せません。";
  if (ctx.assignedTaskCount > 0) {
    return `担当しているタスクが${ctx.assignedTaskCount}件あるため外せません。先にタスクの担当者を替えてください。`;
  }
  return null;
}

/** 役割を変えられない理由。変えられるなら null */
export function roleChangeBlocker(ctx: MemberChangeContext & { nextRole: ProjectRole }): string | null {
  if (ctx.nextRole === "member" && leavesNoOwner(ctx)) {
    return "オーナーが1人もいなくなるため、メンバーにできません。先に別の人をオーナーにしてください。";
  }
  return null;
}
