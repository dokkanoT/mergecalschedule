CREATE TYPE "public"."export_kind" AS ENUM('xlsx', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."project_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."wbs_level" AS ENUM('goal', 'phase');--> statement-breakpoint
CREATE TABLE "exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status_date" date NOT NULL,
	"kind" "export_kind" NOT NULL,
	"file_name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exports_file_name_not_blank" CHECK (btrim("exports"."file_name") <> '')
);
--> statement-breakpoint
CREATE TABLE "help_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	CONSTRAINT "help_requests_body_not_blank" CHECK (btrim("help_requests"."body") <> ''),
	CONSTRAINT "help_requests_resolved_by_set" CHECK ("help_requests"."resolved_at" is null or "help_requests"."resolved_by" is not null)
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"invited_by" text,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token"),
	CONSTRAINT "invitations_email_not_blank" CHECK (btrim("invitations"."email") <> '')
);
--> statement-breakpoint
CREATE TABLE "progress_snapshots" (
	"project_id" uuid NOT NULL,
	"status_date" date NOT NULL,
	"task_id" uuid NOT NULL,
	"progress_pct" smallint NOT NULL,
	CONSTRAINT "progress_snapshots_project_id_status_date_task_id_pk" PRIMARY KEY("project_id","status_date","task_id"),
	CONSTRAINT "progress_snapshots_progress_range" CHECK ("progress_snapshots"."progress_pct" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "project_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_members_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"deadline" date NOT NULL,
	"buffer_days" integer NOT NULL,
	"week_end_weekday" smallint DEFAULT 5 NOT NULL,
	"xlsx_file_name_template" text DEFAULT '{yyMMdd}_{project}工程表v{n}.xlsx' NOT NULL,
	"pdf_file_name_template" text DEFAULT '{yyMMdd}_{project}進捗レポート.pdf' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_not_blank" CHECK (btrim("projects"."name") <> ''),
	CONSTRAINT "projects_color_hex" CHECK ("projects"."color" ~ '^#[0-9a-fA-F]{6}$'),
	CONSTRAINT "projects_buffer_days_min" CHECK ("projects"."buffer_days" >= 1),
	CONSTRAINT "projects_week_end_weekday_range" CHECK ("projects"."week_end_weekday" between 1 and 5),
	CONSTRAINT "projects_xlsx_template_not_blank" CHECK (btrim("projects"."xlsx_file_name_template") <> ''),
	CONSTRAINT "projects_pdf_template_not_blank" CHECK (btrim("projects"."pdf_file_name_template") <> '')
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phase_id" uuid NOT NULL,
	"name" text NOT NULL,
	"deliverable" text NOT NULL,
	"assignee_id" text NOT NULL,
	"planned_start" date NOT NULL,
	"planned_end" date NOT NULL,
	"actual_start" date,
	"actual_end" date,
	"progress_pct" smallint DEFAULT 0 NOT NULL,
	"deliverable_url" text,
	"completion_note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_name_not_blank" CHECK (btrim("tasks"."name") <> ''),
	CONSTRAINT "tasks_deliverable_not_blank" CHECK (btrim("tasks"."deliverable") <> ''),
	CONSTRAINT "tasks_planned_range" CHECK ("tasks"."planned_start" <= "tasks"."planned_end"),
	CONSTRAINT "tasks_actual_range" CHECK ("tasks"."actual_start" is null or "tasks"."actual_end" is null or "tasks"."actual_start" <= "tasks"."actual_end"),
	CONSTRAINT "tasks_progress_range" CHECK ("tasks"."progress_pct" between 0 and 100),
	CONSTRAINT "tasks_planned_start_weekday" CHECK (extract(isodow from "tasks"."planned_start") < 6),
	CONSTRAINT "tasks_planned_end_weekday" CHECK (extract(isodow from "tasks"."planned_end") < 6),
	CONSTRAINT "tasks_actual_start_weekday" CHECK ("tasks"."actual_start" is null or extract(isodow from "tasks"."actual_start") < 6),
	CONSTRAINT "tasks_actual_end_weekday" CHECK ("tasks"."actual_end" is null or extract(isodow from "tasks"."actual_end") < 6),
	CONSTRAINT "tasks_done_needs_deliverable" CHECK ("tasks"."progress_pct" < 100 or coalesce(btrim("tasks"."deliverable_url"), '') <> '' or coalesce(btrim("tasks"."completion_note"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "wbs_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_id" uuid,
	"level" "wbs_level" NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wbs_nodes_id_project_unique" UNIQUE("id","project_id"),
	CONSTRAINT "wbs_nodes_level_parent" CHECK (("wbs_nodes"."level" = 'goal' and "wbs_nodes"."parent_id" is null) or ("wbs_nodes"."level" = 'phase' and "wbs_nodes"."parent_id" is not null)),
	CONSTRAINT "wbs_nodes_name_not_blank" CHECK (btrim("wbs_nodes"."name") <> '')
);
--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "progress_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "progress_snapshots_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_phase_fk" FOREIGN KEY ("phase_id","project_id") REFERENCES "public"."wbs_nodes"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_member_fk" FOREIGN KEY ("project_id","assignee_id") REFERENCES "public"."project_members"("project_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wbs_nodes" ADD CONSTRAINT "wbs_nodes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wbs_nodes" ADD CONSTRAINT "wbs_nodes_parent_fk" FOREIGN KEY ("parent_id","project_id") REFERENCES "public"."wbs_nodes"("id","project_id") ON DELETE cascade ON UPDATE no action;