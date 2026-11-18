import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
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
  // nextCookies は plugins の最後に置く（Server Action から cookie を設定するため）
  plugins: [nextCookies()],
});

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
