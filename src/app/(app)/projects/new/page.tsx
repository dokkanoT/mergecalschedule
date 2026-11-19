import { ProjectForm } from "@/components/projects/project-form";
import { PageHeader } from "@/components/shell/page-header";
import { todayInTokyo } from "@/lib/calendar";
import { DEFAULT_PROJECT_COLOR, DEFAULT_PROJECT_ICON } from "@/lib/project-style";
import {
  DEFAULT_PDF_FILE_NAME_TEMPLATE,
  DEFAULT_WEEK_END_WEEKDAY,
  DEFAULT_XLSX_FILE_NAME_TEMPLATE,
} from "@/lib/rules";
import { createProject } from "../actions";

export const metadata = { title: "プロジェクトを作る | マジスケ" };

export default function NewProjectPage() {
  return (
    <>
      <PageHeader eyebrow="作った人がこのプロジェクトのオーナーになります" title="プロジェクトを作る" />
      <ProjectForm
        action={createProject}
        submitLabel="プロジェクトを作る"
        today={todayInTokyo()}
        initialValues={{
          name: "",
          color: DEFAULT_PROJECT_COLOR,
          icon: DEFAULT_PROJECT_ICON,
          deadline: "",
          bufferDays: "",
          weekEndWeekday: String(DEFAULT_WEEK_END_WEEKDAY),
          xlsxFileNameTemplate: DEFAULT_XLSX_FILE_NAME_TEMPLATE,
          pdfFileNameTemplate: DEFAULT_PDF_FILE_NAME_TEMPLATE,
        }}
      />
    </>
  );
}
