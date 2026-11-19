"use client";

import { CalendarRange, ChartGantt, FileSpreadsheet, ListTree, Plus, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProjectDot } from "@/components/common/project-tile";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

export type SidebarProject = {
  id: string;
  name: string;
  color: string;
  icon: string;
  /** 表示用に整えた締切（例 "1/8"） */
  deadlineLabel: string;
};

type Props = {
  projects: SidebarProject[];
  userName: string;
};

/** パスから選んでいるプロジェクトの id を取り出す（/projects/[id]/...） */
function selectedProjectId(pathname: string, projects: SidebarProject[]): string | null {
  const m = pathname.match(/^\/projects\/([^/]+)/);
  if (m && projects.some((p) => p.id === m[1])) return m[1];
  return null;
}

/** 共通レイアウトのサイドバー（SCREENS.md §3）。幅 768px 未満では上に積む */
export function Sidebar({ projects, userName }: Props) {
  const pathname = usePathname();
  const current = selectedProjectId(pathname, projects) ?? projects[0]?.id ?? null;

  const nav = [
    { href: "/board", label: "チームボード", icon: Users },
    ...(current
      ? [
          { href: `/projects/${current}/gantt`, label: "ガントチャート", icon: ChartGantt },
          { href: `/projects/${current}/wbs`, label: "WBS編集", icon: ListTree },
          { href: `/projects/${current}/report`, label: "週次レポート", icon: FileSpreadsheet },
        ]
      : []),
  ];

  return (
    <aside className="flex w-full flex-col gap-6 border-b border-border bg-surface px-4 py-5 md:w-62 md:shrink-0 md:border-r md:border-b-0 md:py-8">
      <Link href="/board" className="flex items-center gap-3 rounded-field px-2 outline-none focus-visible:ring-3 focus-visible:ring-primary/30">
        <span
          aria-hidden="true"
          className="inline-flex size-10 items-center justify-center rounded-tile bg-primary text-white"
        >
          <CalendarRange strokeWidth={2} className="size-5" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="font-heading text-[20px] font-bold text-ink">マジスケ</span>
          <span className="text-[11px] text-muted-foreground">mergecalschedule</span>
        </span>
      </Link>

      <nav aria-label="メイン">
        <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] md:flex-col">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href} className="shrink-0">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-field px-3 text-[14px] text-ink-2 outline-none hover:bg-background focus-visible:ring-3 focus-visible:ring-primary/30",
                    active && "bg-primary-soft font-bold text-primary-soft-ink hover:bg-primary-soft",
                  )}
                >
                  <Icon aria-hidden="true" strokeWidth={2} className="size-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-labelledby="sidebar-projects" className="space-y-2">
        <div className="flex items-center justify-between px-3">
          <h2 id="sidebar-projects" className="text-[12px] font-bold text-muted-foreground">
            プロジェクト
          </h2>
          <Link href="/projects" className="text-[12px] text-muted-foreground underline-offset-4 hover:underline">
            一覧
          </Link>
        </div>
        <ul className="space-y-1">
          {projects.map((p) => {
            const selected = p.id === selectedProjectId(pathname, projects);
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}/gantt`}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-field px-3 text-[14px] text-ink outline-none hover:bg-background focus-visible:ring-3 focus-visible:ring-primary/30",
                    selected && "bg-background font-bold",
                  )}
                >
                  <ProjectDot color={p.color} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-[12px] text-muted-foreground">{p.deadlineLabel}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/projects/new"
          className="flex min-h-11 items-center gap-2 rounded-field border border-dashed border-border-strong px-3 text-[14px] text-ink-2 outline-none hover:bg-background focus-visible:ring-3 focus-visible:ring-primary/30"
        >
          <Plus aria-hidden="true" strokeWidth={2} className="size-4" />
          プロジェクトを作る
        </Link>
      </section>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-divider px-2 pt-4 text-[13px] text-ink-2">
        <span className="truncate">{userName} さん</span>
        <SignOutButton />
      </div>
    </aside>
  );
}
