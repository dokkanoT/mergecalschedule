import { buildProgressReportPdf } from "@/lib/export/pdf-report";
import { contentDisposition } from "@/lib/export/schedule-sheet";
import { listOpenHelpsForProject, prepareExport, recordExport } from "@/lib/export/server";
import { loadGantt } from "@/lib/gantt/server";

export const runtime = "nodejs";

/** 進捗レポート（PDF）を作って返す。出力履歴と、その日の進捗スナップショットも保存する（R5）。メンバーなら誰でも */
export async function POST(request: Request, { params }: RouteContext<"/projects/[id]/report/pdf">) {
  const { id } = await params;
  const ctx = await prepareExport(id, request);
  if (ctx instanceof Response) return ctx;

  try {
    const [{ nodes, tasks }, helps] = await Promise.all([loadGantt(id, ctx.statusDate, ctx.today), listOpenHelpsForProject(id)]);
    const file = await buildProgressReportPdf({ project: ctx.project, statusDate: ctx.statusDate, today: ctx.today, nodes, tasks, helps });
    const fileName = await recordExport({ ...ctx, kind: "pdf", userId: ctx.user.id, tasks });
    return new Response(new Blob([file as BlobPart]), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(fileName),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("export pdf", e);
    return new Response("進捗レポートを作れませんでした。", { status: 500 });
  }
}
