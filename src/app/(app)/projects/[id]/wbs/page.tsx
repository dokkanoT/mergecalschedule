import { ProjectEyebrow } from "@/components/projects/project-eyebrow";
import { PageHeader } from "@/components/shell/page-header";
import { requireProjectMember } from "@/lib/auth/permissions";
import { todayInTokyo } from "@/lib/calendar";

// WBS編集（仮）。中身はタスク6で作る。メンバーでなければ 404
export default async function Page({ params }: PageProps<"/projects/[id]/wbs">) {
  const { id } = await params;
  const { project } = await requireProjectMember(id);
  return (
    <>
      <PageHeader eyebrow={<ProjectEyebrow project={project} today={todayInTokyo()} />} title="WBS編集" />
      <p className="text-[14px] text-muted-foreground">この画面はタスク6で作ります。</p>
    </>
  );
}
