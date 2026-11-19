import Link from "next/link";
import { primaryButtonClass, secondaryButtonClass } from "@/components/common/buttons";
import { ProjectTile } from "@/components/common/project-tile";
import { RuleAlert } from "@/components/common/rule-alert";
import { AuthCard } from "@/components/shell/auth-card";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { getSession } from "@/lib/auth";
import { normalizeEmail } from "@/lib/invitations";
import { findInvitationByToken, isProjectMember, userExistsWithEmail } from "@/lib/invitations/server";
import { joinWithCurrentUser, registerAndJoin } from "./actions";
import { JoinForm } from "./join-form";

export const metadata = { title: "招待 | マジスケ" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const found = await findInvitationByToken(token);

  if (!found) {
    return (
      <AuthCard title="招待リンクが見つかりません">
        <p className="text-[14px] text-ink-2">リンクが途中で切れていないか確かめてください。取り消された招待の可能性もあります。</p>
        <Link href="/login" className={`${secondaryButtonClass} w-full`}>
          ログイン画面へ
        </Link>
      </AuthCard>
    );
  }
  if (found.state === "expired") {
    return (
      <AuthCard title="招待の期限が切れています">
        <p className="text-[14px] text-ink-2">招待の期限が切れています。招待した人にもう一度送ってもらってください。</p>
      </AuthCard>
    );
  }
  if (found.state === "accepted") {
    return (
      <AuthCard title="この招待はもう使われています">
        <p className="text-[14px] text-ink-2">参加済みの場合は、ログインするとプロジェクトを見られます。</p>
        <Link href="/login" className={`${primaryButtonClass} w-full`}>
          ログイン
        </Link>
      </AuthCard>
    );
  }

  const { invitation, project, inviterName } = found;
  const lead = (
    <div className="flex items-center gap-3 rounded-2xl bg-background p-3">
      <ProjectTile color={project.color} icon={project.icon} />
      <p className="min-w-0 text-[14px] text-ink">
        {inviterName ?? "メンバー"}さんから『<strong>{project.name}</strong>』に招待されています
      </p>
    </div>
  );

  const session = await getSession();
  if (session) {
    if (await isProjectMember(project.id, session.user.id)) {
      return (
        <AuthCard title="すでに参加しています" lead={lead}>
          <Link href="/board" className={`${primaryButtonClass} w-full`}>
            チームボードへ
          </Link>
        </AuthCard>
      );
    }
    if (normalizeEmail(session.user.email) !== invitation.email) {
      return (
        <AuthCard title="別のアカウントでログインしています" lead={lead}>
          <RuleAlert tone="warn" title={`この招待は ${invitation.email} 宛てです`}>
            <p>いまは {session.user.email} でログインしています。ログアウトしてから、もう一度このリンクを開いてください。</p>
          </RuleAlert>
          <div className="flex justify-end">
            <SignOutButton />
          </div>
        </AuthCard>
      );
    }
    return (
      <AuthCard title="プロジェクトに参加" lead={lead}>
        <form action={joinWithCurrentUser.bind(null, token)}>
          <button type="submit" className={`${primaryButtonClass} w-full`}>
            参加する
          </button>
        </form>
      </AuthCard>
    );
  }

  if (await userExistsWithEmail(invitation.email)) {
    return (
      <AuthCard title="ログインして参加" lead={lead}>
        <p className="text-[14px] text-ink-2">{invitation.email} はすでに登録されています。ログインすると参加できます。</p>
        <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className={`${primaryButtonClass} w-full`}>
          ログインして参加
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="登録して参加" lead={lead}>
      <JoinForm email={invitation.email} action={registerAndJoin.bind(null, token)} />
    </AuthCard>
  );
}
