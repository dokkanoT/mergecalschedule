// 招待（CLAUDE.md §3：7日で失効）。純粋関数。トークンの生成と DB 操作はサーバー側で行う。
import type { RuleIssue } from "@/lib/rules/types";

export const INVITATION_TTL_DAYS = 7;

export type ProjectRole = "owner" | "member";
export const PROJECT_ROLES: readonly { value: ProjectRole; label: string }[] = [
  { value: "member", label: "メンバー" },
  { value: "owner", label: "オーナー" },
];

export function roleLabel(role: ProjectRole): string {
  return role === "owner" ? "オーナー" : "メンバー";
}

/** 招待の有効期限（作成から 7 日後） */
export function invitationExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export type InvitationState = "pending" | "accepted" | "expired";

/** 受諾済み → accepted、期限（expiresAt ちょうどを含む）を過ぎた → expired、それ以外 → pending */
export function invitationState(
  invitation: { expiresAt: Date; acceptedAt: Date | null },
  now: Date,
): InvitationState {
  if (invitation.acceptedAt !== null) return "accepted";
  if (now.getTime() >= invitation.expiresAt.getTime()) return "expired";
  return "pending";
}

/** メールアドレスを比べるための形（前後の空白を除き小文字に） */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateInvitationInput(input: { email: string; role: string }): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const email = normalizeEmail(input.email);
  if (email === "") {
    issues.push({ field: "email", message: "メールアドレスを入力してください。" });
  } else if (!EMAIL_PATTERN.test(email)) {
    issues.push({ field: "email", message: "メールアドレスの形式が正しくありません。" });
  }
  if (input.role !== "owner" && input.role !== "member") {
    issues.push({ field: "role", message: "役割はオーナーかメンバーを選んでください。" });
  }
  return issues;
}

/**
 * ログイン後の戻り先として安全なパスか。
 * 自分のサイト内の絶対パス（/ で始まり、// や /\ で始まらない）だけ許す。
 */
export function safeNextPath(next: string | null | undefined, fallback = "/board"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
