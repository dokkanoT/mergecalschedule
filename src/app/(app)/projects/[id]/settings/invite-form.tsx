"use client";

import { useActionState } from "react";
import { primaryButtonClass } from "@/components/common/buttons";
import { Field, inputClass } from "@/components/common/field";
import { RuleAlert } from "@/components/common/rule-alert";
import { PROJECT_ROLES } from "@/lib/invitations";
import type { InviteFormState } from "./actions";
import { CopyLinkButton } from "./copy-link-button";

type Props = {
  action: (prev: InviteFormState, form: FormData) => Promise<InviteFormState>;
};

export function InviteForm({ action }: Props) {
  const [state, formAction, pending] = useActionState(action, { errors: {} });
  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-start gap-3" noValidate>
        <Field id="invite-email" label="メールアドレス" error={state.errors.email} className="min-w-60 flex-[3_1_240px]">
          {(c) => (
            <input
              {...c}
              type="email"
              name="email"
              className={inputClass}
              placeholder="member@example.com"
              autoComplete="off"
              key={state.createdToken ?? "empty"}
            />
          )}
        </Field>
        <Field id="invite-role" label="役割" error={state.errors.role} className="flex-[1_1_140px]">
          {(c) => (
            <select {...c} name="role" className={inputClass} defaultValue="member">
              {PROJECT_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="flex-[0_0_auto] pt-6.5">
          <button type="submit" className={primaryButtonClass} disabled={pending}>
            {pending ? "作成中…" : "招待リンクを作る"}
          </button>
        </div>
      </form>
      {state.formError && <RuleAlert tone="error" title={state.formError} />}
      {state.createdToken && (
        <div role="status" className="space-y-2 rounded-2xl bg-ok-bg px-4 py-3 text-[14px] text-ok-ink">
          <p className="font-bold">{state.createdEmail} さんへの招待リンクを作りました。</p>
          <p className="text-[13px]">メールは送られません。下のリンクをコピーして、本人に渡してください（7日で失効します）。</p>
          <CopyLinkButton path={`/invite/${state.createdToken}`} />
        </div>
      )}
    </div>
  );
}
