import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      // 肩書き（任意）。招待から登録するときに入力する
      title: { type: "string", required: false, input: true },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // 新規登録は招待された人だけ（タスク5）。画面を通らない API 呼び出しもここで止める。
        // 例外：ユーザーがまだ1人もいないとき（最初の1人がプロジェクトを作るため）
        before: async (newUser) => {
          if (await canSignUp(newUser.email)) return;
          throw new APIError("FORBIDDEN", {
            code: "INVITATION_REQUIRED",
            message: "招待されたメールアドレスだけ登録できます。",
          });
        },
      },
    },
  },
  // nextCookies は plugins の最後に置く（Server Action から cookie を設定するため）
  plugins: [nextCookies()],
});

/** ユーザーが0人か、このメールアドレス宛ての有効な招待があれば登録できる */
export async function canSignUp(email: string): Promise<boolean> {
  if (await isFirstUser()) return true;
  const [invite] = await db
    .select({ id: schema.invitations.id })
    .from(schema.invitations)
    .where(
      and(
        eq(schema.invitations.email, email.trim().toLowerCase()),
        isNull(schema.invitations.acceptedAt),
        gt(schema.invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return invite !== undefined;
}

/** まだユーザーが1人もいないか（最初の1人だけはログイン画面から登録できる） */
export async function isFirstUser(): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(schema.user);
  return (row?.n ?? 0) === 0;
}

/** 現在のセッションを返す。未ログインなら null。 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** ログイン必須のページ・Server Action 用。未ログインなら /login へ。 */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}
