import { SecondaryLink } from "@/components/common/buttons";
import { EmptyState } from "@/components/common/empty-state";
import { StatusDateSelect } from "@/components/gantt/status-date-select";
import { ProjectEyebrow } from "@/components/projects/project-eyebrow";
import { DownloadCard } from "@/components/report/download-card";
import { PageHeader } from "@/components/shell/page-header";
import { requireProjectMember } from "@/lib/auth/permissions";
import { isIsoDate, todayInTokyo } from "@/lib/calendar";
import { listExports, previewFileName } from "@/lib/export/server";
import { formatDateTime, formatDateWithWeekday, weekdayLabel } from "@/lib/format";
import { ganttRange, latestSelectableStatusDate, statusDateOptions } from "@/lib/gantt";
import { loadGantt } from "@/lib/gantt/server";
import { FILE_NAME_VARIABLES } from "@/lib/rules";

export const metadata = { title: "週次レポート | マジスケ" };

// 週次レポート（SCREENS.md §5-5）：進捗管理日を選んで工程表（xlsx）と進捗レポート（PDF）を出力する。メンバーなら誰でも
export default async function ReportPage({ params, searchParams }: PageProps<"/projects/[id]/report">) {
  const { id } = await params;
  const { date } = await searchParams;
  const { project, role } = await requireProjectMember(id);
  const today = todayInTokyo();
  const latest = latestSelectableStatusDate(today, project.weekEndWeekday);
  // 既定は次の進捗共有日（今日が進捗共有日なら今日）
  const statusDate = typeof date === "string" && isIsoDate(date) && date <= latest ? date : latest;

  const { tasks } = await loadGantt(id, statusDate, today);
  const range = ganttRange({ tasks, deadline: project.deadline, statusDate });
  const options = statusDateOptions({ rangeStart: range.start, today, weekEndWeekday: project.weekEndWeekday });
  if (!options.some((o) => o.date === statusDate)) {
    options.push({ date: statusDate, label: formatDateWithWeekday(statusDate), isWeekEnd: false });
  }
  const [xlsxName, pdfName, history] = await Promise.all([
    previewFileName(project, "xlsx", statusDate),
    previewFileName(project, "pdf", statusDate),
    listExports(id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={<ProjectEyebrow project={project} today={today} />}
        title="週次レポート"
        actions={<StatusDateSelect value={statusDate} options={options} />}
      />
      <p className="-mt-4 mb-6 text-[14px] text-ink-2">
        毎週{weekdayLabel(project.weekEndWeekday)}曜日は進捗共有の日です。出力すると、その日の全タスクの進捗率を記録します（あとでガントのイナズマ線を再現できます）。
      </p>

      <div className="mb-8 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
        <DownloadCard projectId={id} kind="xlsx" statusDate={statusDate} fileName={xlsxName} />
        <DownloadCard projectId={id} kind="pdf" statusDate={statusDate} fileName={pdfName} />
      </div>

      <section aria-labelledby="templates" className="mb-8 rounded-card border border-border bg-surface p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="templates" className="text-[16px] font-bold text-ink">
            ファイル名のテンプレート
          </h2>
          {role === "owner" && <SecondaryLink href={`/projects/${id}/settings`}>設定で変える</SecondaryLink>}
        </div>
        <dl className="grid gap-2 text-[13px] sm:grid-cols-[auto_1fr] sm:gap-x-4">
          <dt className="font-bold text-ink-2">工程表</dt>
          <dd className="font-mono break-all text-ink">{project.xlsxFileNameTemplate}</dd>
          <dt className="font-bold text-ink-2">進捗レポート</dt>
          <dd className="font-mono break-all text-ink">{project.pdfFileNameTemplate}</dd>
        </dl>
        <p className="mt-3 text-[12px] text-muted-foreground">
          使える変数：{FILE_NAME_VARIABLES.map((v) => <code key={v} className="mx-1 rounded bg-background px-1.5 py-0.5 font-mono">{v}</code>)}
          （進捗管理日・プロジェクト名・出力回数）。チーム固有の記号はそのまま書けます。
        </p>
      </section>

      <section aria-labelledby="history">
        <h2 id="history" className="mb-3 text-[16px] font-bold text-ink">
          出力履歴
        </h2>
        {history.length === 0 ? (
          <EmptyState>まだ出力していません。{formatDateWithWeekday(statusDate, today)} が初回の出力になります。</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead className="border-b border-divider text-[12px] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3 font-bold">進捗管理日</th>
                  <th scope="col" className="px-5 py-3 font-bold">種類</th>
                  <th scope="col" className="px-5 py-3 font-bold">ファイル名</th>
                  <th scope="col" className="px-5 py-3 font-bold">出力した人</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-5 py-3 whitespace-nowrap">{formatDateWithWeekday(h.statusDate, today)}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{h.kind === "xlsx" ? "工程表" : "進捗レポート"}</td>
                    <td className="px-5 py-3 font-mono text-[13px] break-all">{h.fileName}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {h.createdByName ?? "退会したメンバー"}
                      <span className="ml-2 text-[12px] text-muted-foreground">{formatDateTime(h.createdAt, today)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
