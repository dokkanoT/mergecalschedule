import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getSession()) redirect("/board");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">マジスケ</h1>
          <p className="text-sm text-muted-foreground">
            プロジェクト横断のスケジュール管理
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
