"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { projectMembers, projects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { requireProjectOwner } from "@/lib/auth/permissions";
import {
  issuesToErrors,
  type ProjectFormState,
  readProjectForm,
  toProjectSettings,
} from "@/lib/projects/form";
import { validateProjectSettings } from "@/lib/rules";

/** プロジェクトを作る。作った人が owner になる */
export async function createProject(_prev: ProjectFormState, form: FormData): Promise<ProjectFormState> {
  const user = await requireUser();
  const values = readProjectForm(form);
  const input = toProjectSettings(values);
  const issues = validateProjectSettings(input);
  if (issues.length > 0) return { errors: issuesToErrors(issues), values };

  let projectId: string;
  try {
    projectId = await db.transaction(async (tx) => {
      const [created] = await tx.insert(projects).values(input).returning({ id: projects.id });
      await tx.insert(projectMembers).values({ projectId: created.id, userId: user.id, role: "owner" });
      return created.id;
    });
  } catch (e) {
    console.error("createProject", e);
    return { errors: {}, formError: "プロジェクトを作れませんでした。もう一度試してください。", values };
  }
  revalidatePath("/", "layout");
  redirect(`/projects/${projectId}/settings?created=1`);
}

/** プロジェクトの設定を変える（owner だけ） */
export async function updateProject(
  projectId: string,
  _prev: ProjectFormState,
  form: FormData,
): Promise<ProjectFormState> {
  await requireProjectOwner(projectId);
  const values = readProjectForm(form);
  const input = toProjectSettings(values);
  const issues = validateProjectSettings(input);
  if (issues.length > 0) return { errors: issuesToErrors(issues), values };

  try {
    await db.update(projects).set(input).where(eq(projects.id, projectId));
  } catch (e) {
    console.error("updateProject", e);
    return { errors: {}, formError: "保存できませんでした。もう一度試してください。", values };
  }
  revalidatePath("/", "layout");
  return { errors: {}, values, savedAt: Date.now() };
}
