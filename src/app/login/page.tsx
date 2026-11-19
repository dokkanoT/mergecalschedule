import { redirect } from "next/navigation";
import { AuthCard } from "@/components/shell/auth-card";
import { getSession, isFirstUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/invitations";
import { LoginForm } from "./login-form";

export const metadata = { title: "ログイン | マジスケ" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);
  if (await getSession()) redirect(nextPath);

  // 新規登録は招待リンクから。ユーザーがまだ1人もいないときだけ、ここで最初の1人を登録できる
  const firstUser = await isFirstUser();
  return (
    <AuthCard title={firstUser ? "最初の1人を登録" : "ログイン"}>
      <LoginForm mode={firstUser ? "signUp" : "signIn"} nextPath={nextPath} />
    </AuthCard>
  );
}
