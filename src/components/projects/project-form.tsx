"use client";

import { Check } from "lucide-react";
import { useActionState, useState } from "react";
import { primaryButtonClass } from "@/components/common/buttons";
import { Field, inputClass } from "@/components/common/field";
import { ProjectTile } from "@/components/common/project-tile";
import { RuleAlert } from "@/components/common/rule-alert";
import { Toast } from "@/components/common/toast";
import { type IsoDate, isIsoDate } from "@/lib/calendar";
import { formatDateWithWeekday, formatMonthDay, formatWorkdays, WORKDAY_OPTIONS } from "@/lib/format";
import { PROJECT_COLORS, PROJECT_ICONS } from "@/lib/project-style";
import { nextStatusDay, type ProjectFormState, type ProjectFormValues } from "@/lib/projects/form";
import { bufferPeriod, FILE_NAME_VARIABLES, renderFileName } from "@/lib/rules";
import { cn } from "@/lib/utils";

type Props = {
  action: (prev: ProjectFormState, form: FormData) => Promise<ProjectFormState>;
  initialValues: ProjectFormValues;
  submitLabel: string;
  /** 東京の今日（ファイル名のプレビュー用。サーバーから渡す） */
  today: IsoDate;
};

const sectionClass = "space-y-5 rounded-card border border-border bg-surface p-5 md:p-6";

/** プロジェクトの作成・設定フォーム（/projects/new と /projects/[id]/settings で共通） */
export function ProjectForm({ action, initialValues, submitLabel, today }: Props) {
  const [state, formAction, pending] = useActionState(action, { errors: {} });
  const [values, setValues] = useState(initialValues);

  const set = (k: keyof ProjectFormValues) => (v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const errors = state.errors;

  return (
    <form action={formAction} className="max-w-3xl space-y-6" noValidate>
      {state.formError && <RuleAlert tone="error" title={state.formError} />}

      <section aria-labelledby="sec-basic" className={sectionClass}>
        <h2 id="sec-basic" className="text-[16px] font-bold text-ink">
          基本
        </h2>
        <Field id="name" label="プロジェクト名" required error={errors.name}>
          {(c) => (
            <input
              {...c}
              name="name"
              className={inputClass}
              value={values.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="例：minebook"
              autoComplete="off"
            />
          )}
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-[13px] font-bold text-ink-2">色</legend>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <label key={c.color} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="color"
                  value={c.color}
                  checked={values.color === c.color}
                  onChange={() => set("color")(c.color)}
                  aria-label={c.label}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="flex size-11 items-center justify-center rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-3 peer-focus-visible:ring-primary/40"
                  style={{ backgroundColor: c.color }}
                >
                  {values.color === c.color && <Check strokeWidth={3} className="size-5 text-white" />}
                </span>
              </label>
            ))}
          </div>
          {errors.color && <p className="text-[13px] font-medium text-help-ink">{errors.color}</p>}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-[13px] font-bold text-ink-2">アイコン</legend>
          <div className="flex flex-wrap gap-2">
            {PROJECT_ICONS.map((i) => (
              <label key={i.key} className="cursor-pointer" title={i.label}>
                <input
                  type="radio"
                  name="icon"
                  value={i.key}
                  checked={values.icon === i.key}
                  onChange={() => set("icon")(i.key)}
                  aria-label={i.label}
                  className="peer sr-only"
                />
                <span className="block rounded-[16px] p-0.5 ring-offset-1 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-3 peer-focus-visible:ring-primary/40">
                  <ProjectTile color={values.color} icon={i.key} />
                </span>
              </label>
            ))}
          </div>
          {errors.icon && <p className="text-[13px] font-medium text-help-ink">{errors.icon}</p>}
        </fieldset>
      </section>

      <section aria-labelledby="sec-schedule" className={sectionClass}>
        <h2 id="sec-schedule" className="text-[16px] font-bold text-ink">
          締切とバッファ
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="deadline" label="締切日" required error={errors.deadline}>
            {(c) => (
              <input
                {...c}
                type="date"
                name="deadline"
                className={inputClass}
                value={values.deadline}
                onChange={(e) => set("deadline")(e.target.value)}
              />
            )}
          </Field>
          <Field
            id="bufferDays"
            label="バッファ日数（稼働日）"
            required
            error={errors.bufferDays}
            hint="締切日の前に空けておく予備の日数。1以上"
          >
            {(c) => (
              <input
                {...c}
                type="number"
                name="bufferDays"
                min={1}
                step={1}
                inputMode="numeric"
                className={inputClass}
                value={values.bufferDays}
                onChange={(e) => set("bufferDays")(e.target.value)}
              />
            )}
          </Field>
        </div>
        <BufferPreview deadline={values.deadline} bufferDays={values.bufferDays} today={today} />
        <Field
          id="weekEndWeekday"
          label="週の最終曜日"
          error={errors.weekEndWeekday}
          hint="毎週この曜日に進捗を共有します。祝日なら前の稼働日になります"
          className="sm:max-w-xs"
        >
          {(c) => (
            <select
              {...c}
              name="weekEndWeekday"
              className={inputClass}
              value={values.weekEndWeekday}
              onChange={(e) => set("weekEndWeekday")(e.target.value)}
            >
              {WORKDAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </section>

      <section aria-labelledby="sec-files" className={sectionClass}>
        <div className="space-y-1">
          <h2 id="sec-files" className="text-[16px] font-bold text-ink">
            週次レポートのファイル名
          </h2>
          <p className="text-[13px] text-muted-foreground">チーム固有の記号はそのまま書けます。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          使える変数
          {FILE_NAME_VARIABLES.map((v) => (
            <code key={v} className="rounded-full bg-background px-2.5 py-1 font-mono text-[13px] text-ink">
              {v}
            </code>
          ))}
          <span>（進捗管理日・プロジェクト名・出力回数）</span>
        </div>
        {(["xlsxFileNameTemplate", "pdfFileNameTemplate"] as const).map((k) => {
          const kind = k === "xlsxFileNameTemplate" ? "xlsx" : "pdf";
          return (
            <Field
              key={k}
              id={k}
              label={kind === "xlsx" ? "工程表（Excel）" : "進捗レポート（PDF）"}
              required
              error={errors[k]}
              hint={
                <span>
                  プレビュー：
                  <span className="font-mono text-ink">
                    {previewFileName(values[k], kind, values, today)}
                  </span>
                </span>
              }
            >
              {(c) => (
                <input
                  {...c}
                  name={k}
                  className={cn(inputClass, "font-mono text-[13px]")}
                  value={values[k]}
                  onChange={(e) => set(k)(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                />
              )}
            </Field>
          );
        })}
      </section>

      <div className="flex justify-end">
        <button type="submit" className={primaryButtonClass} disabled={pending}>
          {pending ? "保存中…" : submitLabel}
        </button>
      </div>
      {state.savedAt && <Toast key={state.savedAt} message="保存しました" />}
    </form>
  );
}

function BufferPreview({ deadline, bufferDays, today }: { deadline: string; bufferDays: string; today: IsoDate }) {
  const n = Number(bufferDays);
  if (!isIsoDate(deadline) || !Number.isInteger(n) || n < 1) return null;
  const period = bufferPeriod(deadline, n);
  return (
    <p className="rounded-2xl bg-background px-4 py-3 text-[13px] text-ink-2">
      予備期間は {formatMonthDay(period.start, today)}〜{formatMonthDay(period.end, period.start)}（
      {formatWorkdays(n)}）。最終タスクは{" "}
      <strong className="text-ink">{formatDateWithWeekday(period.latestPlannedEnd, today)}</strong>{" "}
      までに終える計画にします。
    </p>
  );
}

function previewFileName(
  template: string,
  kind: "xlsx" | "pdf",
  values: ProjectFormValues,
  today: IsoDate,
): string {
  if (template.trim() === "") return "（テンプレートを入力してください）";
  const weekday = Number(values.weekEndWeekday);
  const statusDate = nextStatusDay(today, Number.isInteger(weekday) && weekday >= 1 && weekday <= 5 ? weekday : 5);
  return renderFileName(template, kind, {
    statusDate,
    projectName: values.name.trim() || "プロジェクト名",
    n: 1,
  });
}
