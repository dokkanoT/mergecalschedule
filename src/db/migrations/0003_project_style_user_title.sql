ALTER TABLE "projects" DROP CONSTRAINT "projects_color_hex";--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "color" SET DEFAULT '#7C5CFA';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "icon" text DEFAULT 'calendar' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_color_palette" CHECK ("projects"."color" in ('#7C5CFA', '#F07B3F', '#2F80ED', '#1F9D6B', '#E0569B', '#C98A0B'));--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_icon_not_blank" CHECK (btrim("projects"."icon") <> '');