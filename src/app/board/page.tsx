import { requireUser } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

// メンバーボード（仮）。カード表示はタスク8で作る。
export default async function BoardPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">メンバーボード</h1>
        <div className="flex items-center gap-3 text-sm">
          <span>{user.name} さん</span>
          <SignOutButton />
        </div>
      </header>
      <p className="text-muted-foreground">ここにメンバーカードが並びます（準備中）。</p>
    </main>
  );
}
