import { ProjectDot } from "@/components/common/project-tile";
import { type IsoDate } from "@/lib/calendar";
import { formatDateWithWeekday, formatWorkdays } from "@/lib/format";

/** ヘッダーの小見出し：色ドット・プロジェクト名・締切・予備日数（SCREENS.md §3） */
export function ProjectEyebrow({
  project,
  today,
}: {
  project: { name: string; color: string; deadline: IsoDate; bufferDays: number };
  today: IsoDate;
}) {
  return (
    <>
      <ProjectDot color={project.color} />
      <span className="font-bold text-ink-2">{project.name}</span>
      <span aria-hidden="true">·</span>
      <span>締切 {formatDateWithWeekday(project.deadline, today)}</span>
      <span aria-hidden="true">·</span>
      <span>予備 {formatWorkdays(project.bufferDays)}</span>
    </>
  );
}
