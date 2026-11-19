"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, getSession, requireUser } from "@/lib/auth";
import { normalizeEmail } from "@/lib/invitations";
import { acceptInvitation, findInvitationByToken } from "@/lib/invitations/server";

export type JoinFormState = {
  errors: { name?: string; password?: string };
  formError?: string;
  values?: { name: string; title: string };
};

/** ログイン済みの人が招待を受ける */
export async function joinWithCurrentUser(token: string): Promise<void> {
  const me = await requireUser();
  const found = await findInvitationByToken(token);
  if (!found || found.state !== "pending") redirect(`/invite/${token}`);
  if (normalizeEmail(me.email) !== found.invitation.email) redirect(`/invite/${token}`);
  await acceptInvitation(found.invitation.id, found.project.id, me.id, found.invitation.role);
  redirect("/board");
}

/** まだアカウントがない人が、招待から登録して参加する */
export async function registerAndJoin(token: string, _prev: JoinFormState, form: FormData): Promise<JoinFormState> {
  const name = String(form.get("name") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const values = { name, title };

  const errors: JoinFormState["errors"] = {};
  if (name === "") errors.name = "名前を入力してください。";
  if (password.length < 8) errors.password = "パスワードは8文字以上にしてください。";
  if (errors.name || errors.password) return { errors, values };

  if (await getSession()) redirect(`/invite/${token}`);
  const found = await findInvitationByToken(token);
  if (!found || found.state !== "pending") redirect(`/invite/${token}`);

  let userId: string;
  try {
    const result = await auth.api.signUpEmail({
      body: { email: found.invitation.email, password, name, title: title === "" ? undefined : title },
      headers: await headers(),
    });
    userId = result.user.id;
  } catch (e) {
    if (isAPIError(e)) {
      const code = (e.body as { code?: string } | undefined)?.code;
      if (code === "USER_ALREADY_EXISTS" || code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
        return { errors: {}, formError: "このメールアドレスはすでに登録されています。ログインしてから参加してください。", values };
      }
      if (code === "PASSWORD_TOO_SHORT") return { errors: { password: "パスワードは8文字以上にしてください。" }, values };
      if (code === "PASSWORD_TOO_LONG") return { errors: { password: "パスワードが長すぎます。" }, values };
    }
    console.error("registerAndJoin", e);
    return { errors: {}, formError: "登録できませんでした。もう一度試してください。", values };
  }

  await acceptInvitation(found.invitation.id, found.project.id, userId, found.invitation.role);
  redirect("/board");
}
