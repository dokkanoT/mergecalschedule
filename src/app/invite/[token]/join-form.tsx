"use client";

import { useActionState } from "react";
import { primaryButtonClass } from "@/components/common/buttons";
import { Field, inputClass } from "@/components/common/field";
import { RuleAlert } from "@/components/common/rule-alert";
import type { JoinFormState } from "./actions";

type Props = {
  email: string;
  action: (prev: JoinFormState, form: FormData) => Promise<JoinFormState>;
};

/** 招待から登録する（名前・肩書き・パスワード） */
export function JoinForm({ email, action }: Props) {
  const [state, formAction, pending] = useActionState(action, { errors: {} });
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field id="email" label="メールアドレス" hint="招待されたアドレスで登録します">
        {(c) => <input {...c} className={inputClass} value={email} readOnly disabled />}
      </Field>
      <Field id="name" label="名前" required error={state.errors.name}>
        {(c) => (
          <input
            {...c}
            name="name"
            className={inputClass}
            autoComplete="name"
            defaultValue={state.values?.name}
            placeholder="例：山田"
          />
        )}
      </Field>
      <Field id="title" label="肩書き" hint="メンバーカードで名前の下に出ます（任意）">
        {(c) => (
          <input
            {...c}
            name="title"
            className={inputClass}
            autoComplete="organization-title"
            defaultValue={state.values?.title}
            placeholder="例：デザイン担当"
          />
        )}
      </Field>
      <Field id="password" label="パスワード" required error={state.errors.password} hint="8文字以上">
        {(c) => <input {...c} type="password" name="password" className={inputClass} autoComplete="new-password" />}
      </Field>
      {state.formError && <RuleAlert tone="error" title={state.formError} />}
      <button type="submit" className={`${primaryButtonClass} w-full`} disabled={pending}>
        {pending ? "登録中…" : "参加する"}
      </button>
    </form>
  );
}
