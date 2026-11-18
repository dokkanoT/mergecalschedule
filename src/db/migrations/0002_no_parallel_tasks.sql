-- Custom SQL migration file, put your code below! --
-- R3：1人が2つ以上のタスクを並列処理しない（プロジェクト横断）
-- 同じ assignee_id の予定期間 [planned_start, planned_end]（両端含む）が、どのプロジェクトのタスクとも重なってはいけない。
-- drizzle-kit は EXCLUDE 制約を生成できないので手書きする。違反時の SQLSTATE は 23P01（exclusion_violation）。
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "no_parallel_tasks"
  EXCLUDE USING gist (
    "assignee_id" WITH =,
    daterange("planned_start", "planned_end", '[]') WITH &&
  );
