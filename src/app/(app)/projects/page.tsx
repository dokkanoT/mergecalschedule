import { Plus, Settings } from "lucide-react";
import Link from "next/link";
import { PrimaryLink } from "@/components/common/buttons";
import { EmptyState } from "@/components/common/empty-state";
import { ProjectTile } from "@/components/common/project-tile";
import { PageHeader } from "@/components/shell/page-header";
import { requireUser } from "@/lib/auth";
import { listMyProjects } from "@/lib/auth/permissions";
import { todayInTokyo, workdaysBetween } from "@/lib/calendar";
import { formatDateWithWeekday, formatWorkdays, weekdayLabel } from "@/lib/format";
import { roleLabel } from "@/lib/invitations";

export const metadata = { title: "プロジェクト | マジスケ" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const rows = await listMyProjects(user.id);
  const today = todayInTokyo();

  return (
    <>
      <PageHeader
        title="プロジェクト"
        actions={
          rows.length > 0 && (
            <PrimaryLink href="/projects/new">
              <Plus aria-hidden="true" strokeWidth={2} />
              プロジェクトを作る
            </PrimaryLink>
          )
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          action={
            <PrimaryLink href="/projects/new">
              <Plus aria-hidden="true" strokeWidth={2} />
              プロジェクトを作る
            </PrimaryLink>
          }
        >
          まだ参加しているプロジェクトがありません。プロジェクトを作るか、招待リンクから参加してください。
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
          {rows.map(({ project, role }) => {
            const left = project.deadline >= today ? workdaysBetween(today, project.deadline) : 0;
            return (
              <li key={project.id} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
                <div className="flex items-start gap-3">
                  <ProjectTile color={project.color} icon={project.icon} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-heading text-[20px] font-bold text-ink">
                      <Link
                        href={`/projects/${project.id}/gantt`}
                        className="outline-none hover:underline focus-visible:underline"
                      >
                        {project.name}
                      </Link>
                    </h2>
                    <p className="text-[12px] text-muted-foreground">{roleLabel(role)}</p>
                  </div>
                  {role === "owner" && (
                    <Link
                      href={`/projects/${project.id}/settings`}
                      aria-label={`${project.name} の設定`}
                      className="inline-flex size-11 items-center justify-center rounded-field text-ink-2 hover:bg-background"
                    >
                      <Settings aria-hidden="true" strokeWidth={2} className="size-5" />
                    </Link>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                  <dt className="text-muted-foreground">締切</dt>
                  <dd className="text-ink">{formatDateWithWeekday(project.deadline, today)}</dd>
                  <dt className="text-muted-foreground">締切まで</dt>
                  <dd className="text-ink">{formatWorkdays(left)}</dd>
                  <dt className="text-muted-foreground">バッファ</dt>
                  <dd className="text-ink">{formatWorkdays(project.bufferDays)}</dd>
                  <dt className="text-muted-foreground">進捗共有</dt>
                  <dd className="text-ink">毎週{weekdayLabel(project.weekEndWeekday)}曜日</dd>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
