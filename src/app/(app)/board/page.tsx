import { PageHeader } from "@/components/shell/page-header";
import { todayInTokyo } from "@/lib/calendar";
import { formatLongDate } from "@/lib/format";

// チームボード（仮）。カード表示はタスク8で作る。
export default function BoardPage() {
  return (
    <>
      <PageHeader eyebrow={formatLongDate(todayInTokyo())} title="今日のチーム" />
      <p className="text-[14px] text-muted-foreground">ここにメンバーカードが並びます（タスク8で作ります）。</p>
    </>
  );
}
