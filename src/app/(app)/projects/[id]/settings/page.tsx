import { and, asc, eq, isNull } from "drizzle-orm";
import { ProjectForm } from "@/components/projects/project-form";
import { ProjectEyebrow } from "@/components/projects/project-eyebrow";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { db } from "@/db";
import { invitations, projectMembers, user } from "@/db/schema";
import { requireProjectOwner } from "@/lib/auth/permissions";
import { todayInTokyo } from "@/lib/calendar";
import { formatDateWithWeekday } from "@/lib/format";
import { invitationState, roleLabel } from "@/lib/invitations";
import { updateProject } from "../../actions";
import { changeMemberRole, createInvitation, revokeInvitation } from "./actions";
import { CopyLinkButton } from "./copy-link-button";
import { InviteForm } from "./invite-form";
import { MemberRoleButton } from "./member-role-button";
import { RevokeInvitationButton } from "./revoke-button";

export const metadata = { title: "プロジェクト設定 | マジスケ" };

const sectionClass = "max-w-3xl space-y-5 rounded-card border border-border bg-surface p-5 md:p-6";

export default async function ProjectSettingsPage({ params, searchParams }: PageProps<"/projects/[id]/settings">) {
  const { id } = await params;
  const { created } = await searchParams;
  const { user: me, project } = await requireProjectOwner(id);
  const today = todayInTokyo();
  const now = new Date();

  const [members, pending] = await Promise.all([
    db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        title: user.title,
        role: projectMembers.role,
      })
      .from(projectMembers)
      .innerJoin(user, eq(user.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, id))
      .orderBy(asc(projectMembers.createdAt)),
    db
      .select()
      .from(invitations)
      .where(and(eq(invitations.projectId, id), isNull(invitations.acceptedAt)))
      .orderBy(asc(invitations.createdAt)),
  ]);

  return (
    <>
      <PageHeader eyebrow={<ProjectEyebrow project={project} today={today} />} title="プロジェクト設定" />

      {created === "1" && (
        <p role="status" className="mb-6 max-w-3xl rounded-2xl bg-ok-bg px-4 py-3 text-[14px] font-medium text-ok-ink">
          プロジェクトを作りました。下の「メンバー」から仲間を招待できます。
        </p>
      )}

      <div className="space-y-8">
        <ProjectForm
          action={updateProject.bind(null, id)}
          submitLabel="設定を保存"
          today={today}
          initialValues={{
            name: project.name,
            color: project.color,
            icon: project.icon,
            deadline: project.deadline,
            bufferDays: String(project.bufferDays),
            weekEndWeekday: String(project.weekEndWeekday),
            xlsxFileNameTemplate: project.xlsxFileNameTemplate,
            pdfFileNameTemplate: project.pdfFileNameTemplate,
          }}
        />

        <section aria-labelledby="sec-members" className={sectionClass}>
          <h2 id="sec-members" className="text-[16px] font-bold text-ink">
            メンバー（{members.length}人）
          </h2>
          <ul className="divide-y divide-divider">
            {members.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
                <span
                  aria-hidden="true"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-free-bg text-[15px] font-bold text-ink-2"
                >
                  {m.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-ink">
                    {m.name}
                    {m.userId === me.id && <span className="ml-2 text-[12px] font-medium text-muted-foreground">あなた</span>}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {[m.title, m.email].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="rounded-full bg-background px-2.5 py-1 text-[12px] font-bold text-ink-2">
                  {roleLabel(m.role)}
                </span>
                <MemberRoleButton
                  memberName={m.name}
                  currentRole={m.role}
                  isSelf={m.userId === me.id}
                  action={changeMemberRole.bind(null, id, m.userId)}
                />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="sec-invite" className={sectionClass}>
          <div className="space-y-1">
            <h2 id="sec-invite" className="text-[16px] font-bold text-ink">
              メンバーを招待
            </h2>
            <p className="text-[13px] text-muted-foreground">
              招待リンクを作って本人に渡してください。リンクから登録・参加できます。7日で失効します。
            </p>
          </div>
          <InviteForm action={createInvitation.bind(null, id)} />

          <h3 className="pt-2 text-[14px] font-bold text-ink">未参加の招待</h3>
          {pending.length === 0 ? (
            <EmptyState>まだ参加していない招待はありません。</EmptyState>
          ) : (
            <ul className="divide-y divide-divider">
              {pending.map((inv) => {
                const expired = invitationState(inv, now) === "expired";
                const expiresOn = todayInTokyo(inv.expiresAt);
                return (
                  <li key={inv.id} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">{inv.email}</span>
                      <span className="rounded-full bg-background px-2.5 py-1 text-[12px] font-bold text-ink-2">
                        {roleLabel(inv.role)}
                      </span>
                      {expired ? (
                        <span className="rounded-full bg-help-bg px-2.5 py-1 text-[12px] font-bold text-help-ink">
                          期限切れ
                        </span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">
                          {formatDateWithWeekday(expiresOn, today)} まで有効
                        </span>
                      )}
                      <RevokeInvitationButton email={inv.email} action={revokeInvitation.bind(null, id, inv.id)} />
                    </div>
                    {!expired && <CopyLinkButton path={`/invite/${inv.token}`} />}
                    {expired && (
                      <p className="text-[12px] text-muted-foreground">
                        もう一度同じメールアドレスで招待リンクを作ると、新しいリンクになります。
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
