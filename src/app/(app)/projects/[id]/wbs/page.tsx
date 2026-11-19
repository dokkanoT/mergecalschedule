import { ProjectEyebrow } from "@/components/projects/project-eyebrow";
import { PageHeader } from "@/components/shell/page-header";
import { RuleCheckPanel } from "@/components/wbs/rule-check-panel";
import { WbsEditor } from "@/components/wbs/wbs-editor";
import { requireProjectMember } from "@/lib/auth/permissions";
import { todayInTokyo } from "@/lib/calendar";
import { summarizeRules } from "@/lib/wbs";
import { loadWbs } from "@/lib/wbs/server";

export const metadata = { title: "WBS編集 | マジスケ" };

// WBS 編集。owner は編集でき、member は同じ表を読み取り専用で見る（SCREENS.md §5-3）
export default async function WbsPage({ params }: PageProps<"/projects/[id]/wbs">) {
  const { id } = await params;
  const { project, role } = await requireProjectMember(id);
  const today = todayInTokyo();
  const { nodes, tasks, members } = await loadWbs(id);
  const canEdit = role === "owner";

  return (
    <>
      <PageHeader eyebrow={<ProjectEyebrow project={project} today={today} />} title="WBS編集" />
      {!canEdit && (
        <p className="mb-5 rounded-2xl bg-background px-4 py-3 text-[13px] text-ink-2">
          WBS を変えられるのはオーナーだけです。自分のタスクの進捗はチームボードから更新します。
        </p>
      )}
      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[999_1_640px]">
          <WbsEditor
            project={{
              id: project.id,
              name: project.name,
              color: project.color,
              icon: project.icon,
              deadline: project.deadline,
              bufferDays: project.bufferDays,
            }}
            nodes={nodes}
            tasks={tasks}
            members={members}
            canEdit={canEdit}
            today={today}
          />
        </div>
        <div className="flex-[1_1_280px]">
          <RuleCheckPanel
            items={summarizeRules({
              tasks,
              deadline: project.deadline,
              bufferDays: project.bufferDays,
              weekEndWeekday: project.weekEndWeekday,
              today,
            })}
          />
        </div>
      </div>
    </>
  );
}
