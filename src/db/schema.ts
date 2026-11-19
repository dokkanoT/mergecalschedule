import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { DEFAULT_PROJECT_COLOR, DEFAULT_PROJECT_ICON, PROJECT_COLORS } from "../lib/project-style"; // drizzle-kit が @ の別名を解決できないため相対パス

// ---------------------------------------------------------------------------
// 認証（Better Auth のコアスキーマ）
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  // 肩書き（任意。メンバーカードで名前の下に出す）。Better Auth の additionalFields
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ---------------------------------------------------------------------------
// アプリ本体
// 日付（予定日・実績日・締切・進捗管理日）はすべて date 型（タイムゾーンなし）で、
// TypeScript 側では "YYYY-MM-DD" の文字列として扱う。
// ルールは DB の制約でも守る（UI・サーバーをすり抜けても保存させない）。
// ---------------------------------------------------------------------------

/** 空文字・空白だけの文字列を禁止する CHECK 用 */
const notBlank = (column: Parameters<typeof sql>[1]) => sql`btrim(${column}) <> ''`;

/** 土日を禁止する CHECK 用（ISO 曜日：月=1 … 日=7）。祝日はサーバー側で判定する（R0） */
const isWeekday = (column: Parameters<typeof sql>[1]) => sql`extract(isodow from ${column}) < 6`;

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

export const projectRole = pgEnum("project_role", ["owner", "member"]);
export const wbsLevel = pgEnum("wbs_level", ["goal", "phase"]);
export const exportKind = pgEnum("export_kind", ["xlsx", "pdf"]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // 色は 6 色のパレットから選ぶ（src/lib/project-style）
    color: text("color").notNull().default(DEFAULT_PROJECT_COLOR),
    // lucide-react のアイコン名。一覧の確認はサーバーで行う
    icon: text("icon").notNull().default(DEFAULT_PROJECT_ICON),
    // R4：締切とバッファは利用者が入力する（コードに固定値を書かない）
    deadline: date("deadline", { mode: "string" }).notNull(),
    bufferDays: integer("buffer_days").notNull(),
    // R5：週の最終曜日（ISO 曜日：月=1 … 金=5）。既定は金曜
    weekEndWeekday: smallint("week_end_weekday").notNull().default(5),
    xlsxFileNameTemplate: text("xlsx_file_name_template")
      .notNull()
      .default("{yyMMdd}_{project}工程表v{n}.xlsx"),
    pdfFileNameTemplate: text("pdf_file_name_template")
      .notNull()
      .default("{yyMMdd}_{project}進捗レポート.pdf"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("projects_name_not_blank", notBlank(t.name)),
    check(
      "projects_color_palette",
      sql`${t.color} in (${sql.raw(PROJECT_COLORS.map((c) => `'${c.color}'`).join(", "))})`,
    ),
    check("projects_icon_not_blank", notBlank(t.icon)),
    check("projects_buffer_days_min", sql`${t.bufferDays} >= 1`),
    check("projects_week_end_weekday_range", sql`${t.weekEndWeekday} between 1 and 5`),
    check("projects_xlsx_template_not_blank", notBlank(t.xlsxFileNameTemplate)),
    check("projects_pdf_template_not_blank", notBlank(t.pdfFileNameTemplate)),
  ],
);

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: projectRole("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
    // 7日で失効（値はサーバーで created_at + 7日 を入れる）
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [check("invitations_email_not_blank", notBlank(t.email))],
);

// 目的（goal）> フェーズ（phase）。タスクはフェーズの下にぶら下がる
export const wbsNodes = pgTable(
  "wbs_nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    level: wbsLevel("level").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // 親は同じプロジェクトのノードに限る
    unique("wbs_nodes_id_project_unique").on(t.id, t.projectId),
    foreignKey({
      name: "wbs_nodes_parent_fk",
      columns: [t.parentId, t.projectId],
      foreignColumns: [t.id, t.projectId],
    }).onDelete("cascade"),
    // 目的は最上位、フェーズは必ず親（目的）を持つ。親が「目的」であることはサーバーで確認する
    check(
      "wbs_nodes_level_parent",
      sql`(${t.level} = 'goal' and ${t.parentId} is null) or (${t.level} = 'phase' and ${t.parentId} is not null)`,
    ),
    check("wbs_nodes_name_not_blank", notBlank(t.name)),
  ],
);

// 全プロジェクト共通の1テーブル。だから R3 をプロジェクト横断で DB が判定できる
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    phaseId: uuid("phase_id").notNull(),
    name: text("name").notNull(),
    // R1：成果物は必須
    deliverable: text("deliverable").notNull(),
    // R2：担当者は1人・必須
    assigneeId: text("assignee_id").notNull(),
    plannedStart: date("planned_start", { mode: "string" }).notNull(),
    plannedEnd: date("planned_end", { mode: "string" }).notNull(),
    actualStart: date("actual_start", { mode: "string" }),
    actualEnd: date("actual_end", { mode: "string" }),
    progressPct: smallint("progress_pct").notNull().default(0),
    deliverableUrl: text("deliverable_url"),
    // R1：完了（100%）にするときの成果物メモ（URL がない場合）
    completionNote: text("completion_note"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // フェーズは同じプロジェクトのもの
    foreignKey({
      name: "tasks_phase_fk",
      columns: [t.phaseId, t.projectId],
      foreignColumns: [wbsNodes.id, wbsNodes.projectId],
    }).onDelete("cascade"),
    // 担当者はそのプロジェクトのメンバー。担当タスクが残っているメンバーは外せない
    // （restrict だとプロジェクト削除の連鎖削除の途中で弾かれるため、文の最後に判定する no action）
    foreignKey({
      name: "tasks_assignee_member_fk",
      columns: [t.projectId, t.assigneeId],
      foreignColumns: [projectMembers.projectId, projectMembers.userId],
    }).onDelete("no action"),
    check("tasks_name_not_blank", notBlank(t.name)),
    check("tasks_deliverable_not_blank", notBlank(t.deliverable)),
    check("tasks_planned_range", sql`${t.plannedStart} <= ${t.plannedEnd}`),
    check(
      "tasks_actual_range",
      sql`${t.actualStart} is null or ${t.actualEnd} is null or ${t.actualStart} <= ${t.actualEnd}`,
    ),
    check("tasks_progress_range", sql`${t.progressPct} between 0 and 100`),
    // R0：土日は選べない
    check("tasks_planned_start_weekday", isWeekday(t.plannedStart)),
    check("tasks_planned_end_weekday", isWeekday(t.plannedEnd)),
    check(
      "tasks_actual_start_weekday",
      sql`${t.actualStart} is null or ${isWeekday(t.actualStart)}`,
    ),
    check("tasks_actual_end_weekday", sql`${t.actualEnd} is null or ${isWeekday(t.actualEnd)}`),
    // R1：完了には成果物の URL かメモが必要
    check(
      "tasks_done_needs_deliverable",
      sql`${t.progressPct} < 100 or coalesce(btrim(${t.deliverableUrl}), '') <> '' or coalesce(btrim(${t.completionNote}), '') <> ''`,
    ),
    // R3：同じ担当者の予定期間の重なり禁止（EXCLUDE 制約）は drizzle-kit が生成できないため、
    // カスタム SQL マイグレーション（src/db/migrations/*_no_parallel_tasks.sql）で追加している
  ],
);

export const helpRequests = pgTable(
  "help_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    check("help_requests_body_not_blank", notBlank(t.body)),
    // 解決者なしの解決はない
    check(
      "help_requests_resolved_by_set",
      sql`${t.resolvedAt} is null or ${t.resolvedBy} is not null`,
    ),
  ],
);

// 週次出力のときに保存し、過去のイナズマ線を再現する
export const progressSnapshots = pgTable(
  "progress_snapshots",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    statusDate: date("status_date", { mode: "string" }).notNull(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    progressPct: smallint("progress_pct").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.statusDate, t.taskId] }),
    check("progress_snapshots_progress_range", sql`${t.progressPct} between 0 and 100`),
  ],
);

// 出力履歴（ファイル本体は保存しない）
export const exports = pgTable(
  "exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    statusDate: date("status_date", { mode: "string" }).notNull(),
    kind: exportKind("kind").notNull(),
    fileName: text("file_name").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [check("exports_file_name_not_blank", notBlank(t.fileName))],
);
