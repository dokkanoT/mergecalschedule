import { ProjectEyebrow } from "@/components/projects/project-eyebrow";
import { PageHeader } from "@/components/shell/page-header";
import { requireProjectMember } from "@/lib/auth/permissions";
import { todayInTokyo } from "@/lib/calendar";

// ガントチャート（仮）。中身はタスク7で作る。メンバーでなければ 404
export default async function Page({ params }: PageProps<"/projects/[id]/gantt">) {
  const { id } = await params;
  const { project } = await requireProjectMember(id);
  return (
    <>
      <PageHeader eyebrow={<ProjectEyebrow project={project} today={todayInTokyo()} />} title="ガントチャート" />
      <p className="text-[14px] text-muted-foreground">この画面はタスク7で作ります。</p>
    </>
  );
}
