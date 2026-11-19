import type { IsoDate } from "@/lib/calendar";
import type { WbsMember, WbsNode, WbsTask } from "@/lib/wbs/server";

export type { WbsMember, WbsNode, WbsTask };

export type WbsProject = {
  id: string;
  name: string;
  color: string;
  icon: string;
  deadline: IsoDate;
  bufferDays: number;
};

/** モーダルの開き方。create は phaseId を決めて開く（null なら画面で選ぶ） */
export type TaskModalState =
  | { mode: "create"; phaseId: string | null }
  | { mode: "edit"; task: WbsTask }
  | null;
