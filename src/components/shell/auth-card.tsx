import { CalendarRange } from "lucide-react";
import type { ReactNode } from "react";

/** ログイン・招待受諾の中央の白カード（最大幅 400px） */
export function AuthCard({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-100 space-y-6 rounded-card border border-border bg-surface p-6 md:p-8">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-tile bg-primary text-white">
            <CalendarRange strokeWidth={2} className="size-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-heading text-[20px] font-bold text-ink">マジスケ</span>
            <span className="text-[11px] text-muted-foreground">mergecalschedule</span>
          </span>
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-[22px] font-bold text-ink">{title}</h1>
          {lead && <div className="text-[14px] text-ink-2">{lead}</div>}
        </div>
        {children}
      </div>
    </main>
  );
}
