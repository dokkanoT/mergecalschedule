import "server-only";
// 週次レポートの出力（xlsx・PDF 共通）：出力履歴の記録と、進捗スナップショットの保存（R5）。
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { exports, helpRequests, progressSnapshots, tasks, user } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { findProjectForUser, type Project } from "@/lib/auth/permissions";
import { type IsoDate, isIsoDate, todayInTokyo } from "@/lib/calendar";
import { latestSelectableStatusDate } from "@/lib/gantt";
import { renderFileName } from "@/lib/rules";

export type ExportKind = "xlsx" | "pdf";

function templateOf(project: Project, kind: ExportKind): string {
  return kind === "xlsx" ? project.xlsxFileNameTemplate : project.pdfFileNameTemplate;
}

/** このプロジェクトでの、その種類の出力回数（{n} に入る次の番号は +1） */
export async function exportCount(projectId: string, kind: ExportKind): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(exports)
    .where(and(eq(exports.projectId, projectId), eq(exports.kind, kind)));
  return Number(row?.count ?? 0);
}

/** 次に出力するときのファイル名（画面のプレビュー用） */
export async function previewFileName(project: Project, kind: ExportKind, statusDate: IsoDate): Promise<string> {
  const n = (await exportCount(project.id, kind)) + 1;
  return renderFileName(templateOf(project, kind), kind, { statusDate, projectName: project.name, n });
}

/**
 * 出力を記録してファイル名を返す。ファイルを作り終えてから呼ぶ（作れなかった出力は履歴に残さない）。
 * 進捗管理日が今日以降なら、その日の全タスクの進捗率をスナップショットとして保存する（同じ日は上書き）。
 * 過去の日のスナップショットは上書きしない（その日の記録を残す）。
 */
export async function recordExport(input: {
  project: Project;
  kind: ExportKind;
  statusDate: IsoDate;
  today: IsoDate;
  userId: string;
  tasks: readonly { id: string; progressPct: number }[];
}): Promise<string> {
  const { project, kind, statusDate } = input;
  return db.transaction(async (tx) => {
    // 同じプロジェクトの出力を順番に通す（{n} が重ならないように）
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`export:${project.id}:${kind}`}))`);
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(exports)
      .where(and(eq(exports.projectId, project.id), eq(exports.kind, kind)));
    const n = Number(row?.count ?? 0) + 1;
    const fileName = renderFileName(templateOf(project, kind), kind, { statusDate, projectName: project.name, n });
    await tx.insert(exports).values({ projectId: project.id, statusDate, kind, fileName, createdBy: input.userId });

    if (statusDate >= input.today && input.tasks.length > 0) {
      await tx
        .insert(progressSnapshots)
        .values(input.tasks.map((t) => ({ projectId: project.id, statusDate, taskId: t.id, progressPct: t.progressPct })))
        .onConflictDoUpdate({
          target: [progressSnapshots.projectId, progressSnapshots.statusDate, progressSnapshots.taskId],
          set: { progressPct: sql`excluded.progress_pct` },
        });
    }
    return fileName;
  });
}

/** 出力履歴（新しい順） */
export async function listExports(projectId: string) {
  return db
    .select({
      id: exports.id,
      statusDate: exports.statusDate,
      kind: exports.kind,
      fileName: exports.fileName,
      createdAt: exports.createdAt,
      createdByName: user.name,
    })
    .from(exports)
    .leftJoin(user, eq(user.id, exports.createdBy))
    .where(eq(exports.projectId, projectId))
    .orderBy(desc(exports.createdAt))
    .limit(50);
}

/**
 * 出力の Route Handler の入口：ログイン・メンバーの確認と、進捗管理日の確認。
 * だめなら Response（404・400）を返す。メンバーでなければプロジェクトがあることも知らせない。
 */
export async function prepareExport(projectId: string, request: Request) {
  const session = await getSession();
  if (!session) return new Response("ログインしてください。", { status: 401 });
  const found = await findProjectForUser(projectId, session.user.id);
  if (!found) return new Response("見つかりません。", { status: 404 });

  const body = (await request.json().catch(() => null)) as { date?: unknown } | null;
  const today = todayInTokyo();
  const date = body?.date;
  if (typeof date !== "string" || !isIsoDate(date) || date > latestSelectableStatusDate(today, found.project.weekEndWeekday)) {
    return new Response("進捗管理日が正しくありません。", { status: 400 });
  }
  return { user: session.user, project: found.project, statusDate: date as IsoDate, today };
}

/** 進捗レポートに出す、プロジェクトの未解決の困りごと（古い順） */
export async function listOpenHelpsForProject(projectId: string) {
  return db
    .select({
      id: helpRequests.id,
      body: helpRequests.body,
      createdAt: helpRequests.createdAt,
      taskName: tasks.name,
      posterName: user.name,
    })
    .from(helpRequests)
    .innerJoin(tasks, eq(tasks.id, helpRequests.taskId))
    .innerJoin(user, eq(user.id, helpRequests.userId))
    .where(and(eq(tasks.projectId, projectId), isNull(helpRequests.resolvedAt)))
    .orderBy(asc(helpRequests.createdAt));
}
