"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

type Mode = "signIn" | "signUp";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signIn");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "");

    const { error } =
      mode === "signUp"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });

    setPending(false);
    if (error) {
      setError(toJapaneseMessage(error.code, mode));
      return;
    }
    router.replace("/board");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "signIn" ? "ログイン" : "新規登録"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "signUp" && (
            <div className="space-y-2">
              <Label htmlFor="name">名前</Label>
              <Input id="name" name="name" required autoComplete="name" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード（8文字以上）</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signUp" ? "new-password" : "current-password"}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "処理中…" : mode === "signIn" ? "ログイン" : "登録する"}
          </Button>
        </form>
        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => {
            setError(null);
            setMode(mode === "signIn" ? "signUp" : "signIn");
          }}
        >
          {mode === "signIn" ? "アカウントをお持ちでない方はこちら" : "ログインに戻る"}
        </button>
      </CardContent>
    </Card>
  );
}

function toJapaneseMessage(code: string | undefined, mode: Mode): string {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "メールアドレスまたはパスワードが違います。";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "このメールアドレスはすでに登録されています。";
    case "PASSWORD_TOO_SHORT":
      return "パスワードは8文字以上にしてください。";
    case "INVALID_EMAIL":
      return "メールアドレスの形式が正しくありません。";
    default:
      return mode === "signUp" ? "登録に失敗しました。" : "ログインに失敗しました。";
  }
}
