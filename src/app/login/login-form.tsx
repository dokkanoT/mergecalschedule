"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { primaryButtonClass } from "@/components/common/buttons";
import { Field, inputClass } from "@/components/common/field";
import { RuleAlert } from "@/components/common/rule-alert";
import { authClient } from "@/lib/auth/client";

type Mode = "signIn" | "signUp";

type Props = {
  /** signUp はユーザーが0人のときだけ（最初の1人） */
  mode: Mode;
  /** ログイン後の戻り先（サイト内のパス） */
  nextPath: string;
};

export function LoginForm({ mode, nextPath }: Props) {
  const router = useRouter();
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
    const title = String(form.get("title") ?? "").trim();

    const { error } =
      mode === "signUp"
        ? await authClient.signUp.email({ email, password, name, title: title === "" ? undefined : title })
        : await authClient.signIn.email({ email, password });

    setPending(false);
    if (error) {
      setError(toJapaneseMessage(error.code, mode));
      return;
    }
    router.replace(mode === "signUp" ? "/projects/new" : nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {mode === "signUp" && (
        <>
          <p className="text-[13px] text-ink-2">
            まだ誰も登録していません。最初の1人として登録すると、プロジェクトを作って仲間を招待できます。2人目からは招待リンクで登録します。
          </p>
          <Field id="name" label="名前" required>
            {(c) => <input {...c} name="name" required className={inputClass} autoComplete="name" />}
          </Field>
          <Field id="title" label="肩書き" hint="任意">
            {(c) => <input {...c} name="title" className={inputClass} autoComplete="organization-title" />}
          </Field>
        </>
      )}
      <Field id="email" label="メールアドレス" required>
        {(c) => (
          <input
            {...c}
            id="email"
            name="email"
            type="email"
            required
            className={inputClass}
            autoComplete="email"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
          />
        )}
      </Field>
      <Field id="password" label="パスワード" required hint={mode === "signUp" ? "8文字以上" : undefined}>
        {(c) => (
          <input
            {...c}
            name="password"
            type="password"
            required
            minLength={8}
            className={inputClass}
            autoComplete={mode === "signUp" ? "new-password" : "current-password"}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : c["aria-describedby"]}
          />
        )}
      </Field>
      {error && (
        <div id="login-error">
          <RuleAlert tone="error" title={error} />
        </div>
      )}
      <button type="submit" className={`${primaryButtonClass} w-full`} disabled={pending}>
        {pending ? "処理中…" : mode === "signIn" ? "ログイン" : "登録する"}
      </button>
      {mode === "signIn" && (
        <p className="text-center text-[13px] text-muted-foreground">
          アカウントは招待リンクから作ります。招待してくれた人にリンクを送ってもらってください。
        </p>
      )}
    </form>
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
    case "INVITATION_REQUIRED":
      return "招待されたメールアドレスだけ登録できます。招待リンクから登録してください。";
    default:
      return mode === "signUp" ? "登録に失敗しました。" : "ログインに失敗しました。";
  }
}
