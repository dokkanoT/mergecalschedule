import { describe, expect, it } from "vitest";
import {
  INVITATION_TTL_DAYS,
  invitationExpiresAt,
  invitationState,
  normalizeEmail,
  safeNextPath,
  validateInvitationInput,
} from "@/lib/invitations";
import { memberRemovalBlocker, roleChangeBlocker } from "@/lib/projects/members";

describe("招待の有効期限（7日）", () => {
  const created = new Date("2026-11-19T10:00:00+09:00");
  const expiresAt = invitationExpiresAt(created);

  it("作成から 7 日後に失効する", () => {
    expect(INVITATION_TTL_DAYS).toBe(7);
    expect(expiresAt.toISOString()).toBe(new Date("2026-11-26T10:00:00+09:00").toISOString());
  });

  it("期限の直前は有効、ちょうど・過ぎたら失効", () => {
    expect(invitationState({ expiresAt, acceptedAt: null }, new Date("2026-11-26T09:59:59+09:00"))).toBe("pending");
    expect(invitationState({ expiresAt, acceptedAt: null }, new Date("2026-11-26T10:00:00+09:00"))).toBe("expired");
    expect(invitationState({ expiresAt, acceptedAt: null }, new Date("2026-12-01T00:00:00+09:00"))).toBe("expired");
  });

  it("受諾済みは期限に関係なく受諾済み", () => {
    const acceptedAt = new Date("2026-11-20T12:00:00+09:00");
    expect(invitationState({ expiresAt, acceptedAt }, new Date("2026-11-21T00:00:00+09:00"))).toBe("accepted");
    expect(invitationState({ expiresAt, acceptedAt }, new Date("2026-12-31T00:00:00+09:00"))).toBe("accepted");
  });
});

describe("招待の入力チェック", () => {
  it("正しい入力なら問題なし", () => {
    expect(validateInvitationInput({ email: "member@example.com", role: "member" })).toEqual([]);
    expect(validateInvitationInput({ email: " Owner@Example.com ", role: "owner" })).toEqual([]);
  });

  it("メールが空・形式違い、役割が不正なら拒否", () => {
    expect(validateInvitationInput({ email: "", role: "member" }).map((i) => i.field)).toEqual(["email"]);
    expect(validateInvitationInput({ email: "not-an-email", role: "member" })[0]?.message).toContain("形式");
    expect(validateInvitationInput({ email: "a@example.com", role: "admin" }).map((i) => i.field)).toEqual(["role"]);
  });

  it("メールアドレスは小文字にそろえて比べる", () => {
    expect(normalizeEmail("  Taro@Example.COM ")).toBe("taro@example.com");
  });
});

describe("ログイン後の戻り先", () => {
  it("サイト内のパスだけ許す", () => {
    expect(safeNextPath("/invite/abc")).toBe("/invite/abc");
    expect(safeNextPath(null)).toBe("/board");
    expect(safeNextPath("https://evil.example.com")).toBe("/board");
    expect(safeNextPath("//evil.example.com")).toBe("/board");
    expect(safeNextPath("/\\evil.example.com")).toBe("/board");
  });
});

describe("メンバーを外す・役割を変える", () => {
  const base = { targetRole: "member" as const, ownerCount: 1, isSelf: false, assignedTaskCount: 0 };

  it("担当タスクのないメンバーは外せる", () => {
    expect(memberRemovalBlocker(base)).toBeNull();
  });

  it("担当タスクがあると外せない（件数を出す）", () => {
    expect(memberRemovalBlocker({ ...base, assignedTaskCount: 2 })).toContain("2件");
  });

  it("自分自身は外せない", () => {
    expect(memberRemovalBlocker({ ...base, targetRole: "owner", ownerCount: 2, isSelf: true })).toContain("自分自身");
  });

  it("最後のオーナーは外せない。オーナーが2人いれば外せる", () => {
    expect(memberRemovalBlocker({ ...base, targetRole: "owner", ownerCount: 1 })).toContain("オーナーが1人も");
    expect(memberRemovalBlocker({ ...base, targetRole: "owner", ownerCount: 2 })).toBeNull();
  });

  it("最後のオーナーはメンバーにできない。メンバー → オーナーはいつでもできる", () => {
    const owner = { targetRole: "owner" as const, ownerCount: 1, isSelf: true };
    expect(roleChangeBlocker({ ...owner, nextRole: "member" })).toContain("オーナーが1人も");
    expect(roleChangeBlocker({ ...owner, ownerCount: 2, nextRole: "member" })).toBeNull();
    expect(roleChangeBlocker({ targetRole: "member", ownerCount: 1, isSelf: false, nextRole: "owner" })).toBeNull();
  });
});
