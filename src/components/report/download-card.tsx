"use client";

import { Download, FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { primaryButtonClass } from "@/components/common/buttons";
import { RuleAlert } from "@/components/common/rule-alert";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  kind: "xlsx" | "pdf";
  statusDate: string;
  /** 次に出力するときのファイル名 */
  fileName: string;
  /** まだ作っていない出力（ボタンを無効にする） */
  unavailable?: string;
};

const META = {
  xlsx: {
    title: "工程表",
    format: "Excel（.xlsx）",
    description: "WBS とガントを1枚のシートに。土日祝はグレー、予備期間は斜線、締切日に赤い線。",
    icon: FileSpreadsheet,
    tile: "bg-sheet-tile text-sheet-tile-ink",
  },
  pdf: {
    title: "進捗レポート",
    format: "PDF",
    description: "全体の進捗・締切まで・バッファ、イナズマ線付きのガント、遅れタスクと困りごとの一覧。",
    icon: FileText,
    tile: "bg-help-bg text-help-strong",
  },
} as const;

/** Content-Disposition の filename* から日本語のファイル名を取り出す */
function fileNameFrom(header: string | null, fallback: string): string {
  const match = header?.match(/filename\*=UTF-8''([^;]+)/);
  if (!match?.[1]) return fallback;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return fallback;
  }
}

/** 週次レポートのダウンロードカード（SCREENS.md §5-5）。押すとその場で作って保存する */
export function DownloadCard({ projectId, kind, statusDate, fileName, unavailable }: Props) {
  const meta = META[kind];
  const Icon = meta.icon;
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function download() {
    if (state === "loading" || unavailable) return;
    setState("loading");
    try {
      const res = await fetch(`/projects/${projectId}/report/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: statusDate }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameFrom(res.headers.get("Content-Disposition"), fileName);
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState("idle");
      router.refresh(); // 出力履歴と次のファイル名（{n}）を更新
    } catch (e) {
      console.error(e);
      setState("error");
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6" aria-labelledby={`dl-${kind}`}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={cn("inline-flex size-11 items-center justify-center rounded-tile", meta.tile)}>
          <Icon strokeWidth={2} className="size-5" />
        </span>
        <div>
          <h2 id={`dl-${kind}`} className="text-[17px] font-bold text-ink">
            {meta.title}
          </h2>
          <p className="text-[13px] text-muted-foreground">{meta.format}</p>
        </div>
      </div>
      <p className="text-[14px] text-ink-2">{meta.description}</p>
      <p className="rounded-field bg-background px-3 py-2 font-mono text-[13px] break-all text-ink">{fileName}</p>
      {state === "error" && (
        <RuleAlert tone="error" title={`${meta.title}を作れませんでした`}>
          <button type="button" className="font-bold underline underline-offset-4" onClick={download}>
            もう一度試す
          </button>
        </RuleAlert>
      )}
      <button
        type="button"
        className={cn(primaryButtonClass, "mt-auto min-h-12")}
        aria-disabled={state === "loading" || unavailable ? true : undefined}
        onClick={download}
      >
        {state === "loading" ? (
          <>
            <LoaderCircle aria-hidden="true" className="animate-spin" />
            作成中…
          </>
        ) : (
          <>
            <Download aria-hidden="true" />
            {unavailable ?? `${meta.title}をダウンロード`}
          </>
        )}
      </button>
    </section>
  );
}
