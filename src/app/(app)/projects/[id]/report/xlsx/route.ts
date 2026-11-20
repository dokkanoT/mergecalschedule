import { contentDisposition } from "@/lib/export/schedule-sheet";
import { prepareExport, recordExport } from "@/lib/export/server";
import { buildScheduleXlsx } from "@/lib/export/xlsx";
import { loadGantt } from "@/lib/gantt/server";

export const runtime = "nodejs";

/** 工程表（xlsx）を作って返す。出力履歴と、その日の進捗スナップショットも保存する（R5）。メンバーなら誰でも */
export async function POST(request: Request, { params }: RouteContext<"/projects/[id]/report/xlsx">) {
  const { id } = await params;
  const ctx = await prepareExport(id, request);
  if (ctx instanceof Response) return ctx;

  try {
    const { nodes, tasks } = await loadGantt(id, ctx.statusDate, ctx.today);
    const file = await buildScheduleXlsx({ project: ctx.project, statusDate: ctx.statusDate, nodes, tasks });
    const fileName = await recordExport({ ...ctx, kind: "xlsx", userId: ctx.user.id, tasks });
    return new Response(new Blob([file as BlobPart]), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDisposition(fileName),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("export xlsx", e);
    return new Response("工程表を作れませんでした。", { status: 500 });
  }
}
