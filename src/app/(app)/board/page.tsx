import { MemberCardView } from "@/components/board/member-card";
import { ProjectFilter } from "@/components/board/project-filter";
import { PrimaryLink } from "@/components/common/buttons";
import { EmptyState } from "@/components/common/empty-state";
import { StatusPill } from "@/components/common/status-pill";
import { PageHeader } from "@/components/shell/page-header";
import { requireUser } from "@/lib/auth";
import { boardSummary, buildMemberCard, filterMembers, memberTaskList, sortMemberCards } from "@/lib/board";
import { type LoadedBoardTask, loadBoard } from "@/lib/board/server";
import { todayInTokyo } from "@/lib/calendar";
import { formatLongDate } from "@/lib/format";

// チームボード（ログイン後の初期画面、SCREENS.md §5-1）。
// 自分と同じプロジェクトにいるメンバーを1人1枚のカードで並べる。予定は全プロジェクト横断で見る。
export default async function BoardPage({ searchParams }: PageProps<"/board">) {
  const me = await requireUser();
  const today = todayInTokyo();
  const { projects, members, tasks } = await loadBoard(me.id);
  const { project } = await searchParams;
  const selected = typeof project === "string" && projects.some((p) => p.id === project) ? project : null;

  const tasksByMember = new Map<string, LoadedBoardTask[]>();
  for (const t of tasks) {
    const list = tasksByMember.get(t.assigneeId) ?? [];
    list.push(t);
    tasksByMember.set(t.assigneeId, list);
  }
  const cards = sortMemberCards(
    filterMembers(members, selected).map((m) => buildMemberCard(m, tasksByMember.get(m.userId) ?? [], today)),
  );
  const summary = boardSummary(cards);

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(today)}
        title="今日のチーム"
        actions={
          cards.length > 0 && (
            <>
              <StatusPill status="help" label={`困りごと ${summary.help}`} />
              <StatusPill status="late" label={`遅れ ${summary.late}`} />
              <StatusPill status="free" label={`空き ${summary.free}`} />
            </>
          )
        }
      />

      {projects.length === 0 ? (
        <EmptyState action={<PrimaryLink href="/projects/new">＋ プロジェクトを作る</PrimaryLink>}>
          まだプロジェクトがありません。プロジェクトを作るか、招待リンクから参加してください。
        </EmptyState>
      ) : (
        <>
          {projects.length > 1 && <ProjectFilter projects={projects} selected={selected} />}
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]">
            {cards.map((card) => (
              <MemberCardView
                key={card.member.userId}
                card={card}
                tasks={memberTaskList(tasksByMember.get(card.member.userId) ?? [])}
                isMe={card.member.userId === me.id}
                today={today}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
