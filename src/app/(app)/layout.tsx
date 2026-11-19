import { Sidebar } from "@/components/shell/sidebar";
import { requireUser } from "@/lib/auth";
import { listMyProjects } from "@/lib/auth/permissions";
import { todayInTokyo } from "@/lib/calendar";
import { formatMonthDay } from "@/lib/format";

// ログイン後の画面の共通レイアウト（サイドバー＋本文）
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const rows = await listMyProjects(user.id);
  const today = todayInTokyo();

  return (
    <div className="flex flex-1 flex-wrap bg-background md:flex-nowrap">
      <Sidebar
        userName={user.name}
        projects={rows.map(({ project }) => ({
          id: project.id,
          name: project.name,
          color: project.color,
          icon: project.icon,
          deadlineLabel: formatMonthDay(project.deadline, today),
        }))}
      />
      <main className="min-w-0 flex-[999_1_560px] px-4 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}
