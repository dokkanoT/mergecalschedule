import { ProjectEyebrow } from "@/components/projects/project-eyebrow";
import { PageHeader } from "@/components/shell/page-header";
import { requireProjectMember } from "@/lib/auth/permissions";
import { todayInTokyo } from "@/lib/calendar";

// 週次レポート（仮）。中身はタスク10・11で作る。メンバーでなければ 404
export default async function Page({ params }: PageProps<"/projects/[id]/report">) {
  const { id } = await params;
  const { project } = await requireProjectMember(id);
  return (
    <>
      <PageHeader eyebrow={<ProjectEyebrow project={project} today={todayInTokyo()} />} title="週次レポート" />
      <p className="text-[14px] text-muted-foreground">この画面はタスク10・11で作ります。</p>
    </>
  );
}
