// DB 制約（R0〜R4 の DB 側の守り）が効いているかを確かめるスクリプト。
// すべて1つのトランザクションの中で試し、最後にロールバックするので DB にデータは残らない。
// 使い方：pnpm db:check（.env.local の DATABASE_URL_UNPOOLED に接続する）
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED が設定されていません");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const client = await pool.connect();

/** SQLSTATE の意味（表示用） */
const CODE = {
  ok: "OK",
  "23P01": "排他制約違反",
  "23514": "CHECK 違反",
  "23502": "NOT NULL 違反",
  "23503": "外部キー違反",
};

const results = [];

/** SAVEPOINT の中で SQL を流し、期待した結果（"ok" か SQLSTATE）になるかを記録する */
async function expect(label, expected, text, params = []) {
  await client.query("SAVEPOINT t");
  let actual = "ok";
  let detail = "";
  try {
    await client.query(text, params);
    await client.query("RELEASE SAVEPOINT t");
  } catch (e) {
    actual = e.code ?? "error";
    detail = e.constraint ?? e.message;
    await client.query("ROLLBACK TO SAVEPOINT t");
  }
  results.push({ pass: actual === expected, label, expected, actual, detail });
}

try {
  await client.query("BEGIN");

  // --- 準備：ユーザー3人、プロジェクト2つ（u3 はどちらのメンバーでもない） ---
  for (const id of ["chk_u1", "chk_u2", "chk_u3"]) {
    await client.query(`insert into "user" (id, name, email) values ($1, $1, $1 || '@example.test')`, [id]);
  }
  const project = async (name) =>
    (
      await client.query(
        `insert into projects (name, deadline, buffer_days) values ($1, '2027-01-08', 5) returning id`,
        [name],
      )
    ).rows[0].id;
  const pA = await project("チェック用A");
  const pB = await project("チェック用B");
  for (const p of [pA, pB]) {
    for (const u of ["chk_u1", "chk_u2"]) {
      await client.query(`insert into project_members (project_id, user_id) values ($1, $2)`, [p, u]);
    }
  }
  const phase = async (p) => {
    const goal = (
      await client.query(
        `insert into wbs_nodes (project_id, level, name) values ($1, 'goal', '目的') returning id`,
        [p],
      )
    ).rows[0].id;
    return (
      await client.query(
        `insert into wbs_nodes (project_id, parent_id, level, name) values ($1, $2, 'phase', 'フェーズ') returning id`,
        [p, goal],
      )
    ).rows[0].id;
  };
  const phA = await phase(pA);
  const phB = await phase(pB);

  const insertTask = `insert into tasks (project_id, phase_id, name, deliverable, assignee_id, planned_start, planned_end, progress_pct, completion_note)
    values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, 0), $9) returning id`;
  const task = (p, ph, assignee, start, end, extra = {}) => [
    p,
    ph,
    extra.name ?? "タスク",
    extra.deliverable ?? "成果物",
    assignee,
    start,
    end,
    extra.progress ?? null,
    extra.note ?? null,
  ];

  // 基準のタスク：u1 が A で 2026-11-24(火)〜11-27(金)
  const base = (await client.query(insertTask, task(pA, phA, "chk_u1", "2026-11-24", "2026-11-27"))).rows[0].id;

  // --- R3：並列禁止（プロジェクト横断） ---
  await expect("R3 別プロジェクトで期間が重なる", "23P01", insertTask, task(pB, phB, "chk_u1", "2026-11-26", "2026-12-01"));
  await expect("R3 同じプロジェクトで期間が重なる", "23P01", insertTask, task(pA, phA, "chk_u1", "2026-11-25", "2026-11-25"));
  await expect("R3 端の1日だけ重なる（11/27）", "23P01", insertTask, task(pB, phB, "chk_u1", "2026-11-27", "2026-12-02"));
  await expect("R3 隣接（11/30 開始）は重ならない", "ok", insertTask, task(pB, phB, "chk_u1", "2026-11-30", "2026-12-02"));
  await expect("R3 担当者が違えば重なってもよい", "ok", insertTask, task(pB, phB, "chk_u2", "2026-11-24", "2026-11-27"));
  await expect("R3 自分自身の更新は衝突しない", "ok", `update tasks set name = '名前変更', planned_end = '2026-11-26' where id = $1`, [base]);
  await expect("R3 更新で別タスクに重ねる", "23P01", `update tasks set planned_end = '2026-12-01' where id = $1`, [base]);

  // --- R0：土日は選べない（祝日はサーバー側で判定するので DB では通る） ---
  await expect("R0 土曜（11/28）開始", "23514", insertTask, task(pA, phA, "chk_u2", "2026-11-28", "2026-12-01"));
  await expect("R0 日曜（11/29）終了", "23514", insertTask, task(pA, phA, "chk_u2", "2026-12-07", "2026-12-13"));
  await expect("R0 祝日（11/23 勤労感謝の日）は DB では通る（サーバーで拒否）", "ok", insertTask, task(pA, phA, "chk_u2", "2026-11-23", "2026-11-23"));
  await expect("R0 実績日に土曜", "23514", `update tasks set actual_start = '2026-11-28' where id = $1`, [base]);

  // --- R1：成果物 ---
  await expect("R1 成果物が空白だけ", "23514", insertTask, task(pA, phA, "chk_u2", "2026-12-14", "2026-12-14", { deliverable: "  " }));
  await expect("R1 完了なのに URL もメモもない", "23514", insertTask, task(pA, phA, "chk_u2", "2026-12-15", "2026-12-15", { progress: 100 }));
  await expect("R1 完了でメモあり", "ok", insertTask, task(pA, phA, "chk_u2", "2026-12-16", "2026-12-16", { progress: 100, note: "テスト結果報告書を共有済み" }));

  // --- R2：担当者 ---
  await expect("R2 担当者なし", "23502", insertTask, task(pA, phA, null, "2026-12-17", "2026-12-17"));
  await expect("R2 プロジェクトのメンバーでない人", "23503", insertTask, task(pA, phA, "chk_u3", "2026-12-17", "2026-12-17"));

  // --- その他の整合性 ---
  await expect("予定開始 > 予定終了", "23514", insertTask, task(pA, phA, "chk_u2", "2026-12-18", "2026-12-17"));
  await expect("進捗率 101", "23514", insertTask, task(pA, phA, "chk_u2", "2026-12-21", "2026-12-21", { progress: 101, note: "メモ" }));
  await expect("別プロジェクトのフェーズにタスクを付ける", "23503", insertTask, task(pA, phB, "chk_u2", "2026-12-22", "2026-12-22"));
  await expect("R4 バッファ0日", "23514", `insert into projects (name, deadline, buffer_days) values ('x', '2027-01-08', 0)`);
  await expect("R5 週の最終曜日が土曜（6）", "23514", `insert into projects (name, deadline, buffer_days, week_end_weekday) values ('x', '2027-01-08', 3, 6)`);
  await expect("プロジェクト色がパレット外（#3b82f6）", "23514", `insert into projects (name, deadline, buffer_days, color) values ('x', '2027-01-08', 3, '#3b82f6')`);
  await expect("プロジェクト色・アイコンの既定値（紫・カレンダー）", "ok", `insert into projects (name, deadline, buffer_days) values ('x', '2027-01-08', 3) returning 1 / (color = '#7C5CFA' and icon = 'calendar')::int`);
  await expect("プロジェクトのアイコンが空白", "23514", `insert into projects (name, deadline, buffer_days, icon) values ('x', '2027-01-08', 3, ' ')`);
  await expect("ユーザーの肩書きは空でもよい", "ok", `update "user" set title = null where id = 'chk_u1'`);
  await expect("WBS 親のないフェーズ", "23514", `insert into wbs_nodes (project_id, level, name) values ($1, 'phase', 'x')`, [pA]);
  await expect("担当タスクがあるメンバーは外せない", "23503", `delete from project_members where project_id = $1 and user_id = 'chk_u1'`, [pA]);
  await expect("プロジェクト削除で配下がまとめて消える", "ok", `delete from projects where id = $1`, [pA]);
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  const mark = r.pass ? "✓" : "✗";
  const got = CODE[r.actual] ?? r.actual;
  const want = CODE[r.expected] ?? r.expected;
  console.log(`${mark} ${r.label}：期待=${want} 結果=${got}${r.detail ? `（${r.detail}）` : ""}`);
}
console.log(`\n${results.length - failed} 件成功 / ${failed} 件失敗（データはロールバック済み）`);
process.exit(failed ? 1 : 0);
