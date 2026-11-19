import type { ReactNode } from "react";

type Props = {
  /** 小見出し（プロジェクト情報か日付） */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** 右側の操作 */
  actions?: ReactNode;
};

/** 画面のヘッダー（SCREENS.md §3：小見出し＋h1／右に操作） */
export function PageHeader({ eyebrow, title, actions }: Props) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        {eyebrow && <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">{eyebrow}</div>}
        <h1 className="font-heading text-[26px] font-bold text-ink md:text-[32px]">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
