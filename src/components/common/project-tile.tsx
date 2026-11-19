import { cn } from "@/lib/utils";
import { tintOf } from "@/lib/project-style";
import { ProjectIconGlyph } from "./project-icon";

type Props = {
  color: string;
  icon: string;
  size?: "lg" | "sm";
  /** sm のとき、tint 背景＋色枠で描く（「つぎ」の表示用） */
  outline?: boolean;
  className?: string;
};

/** プロジェクト色の角丸四角に白い線アイコン（SCREENS.md §4） */
export function ProjectTile({ color, icon, size = "lg", outline = false, className }: Props) {
  const lg = size === "lg";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        lg ? "size-11 rounded-tile" : "size-7 rounded-tile-sm",
        outline && "border-2",
        className,
      )}
      style={
        outline
          ? { backgroundColor: tintOf(color) ?? "#EDEEF1", borderColor: color, color }
          : { backgroundColor: color, color: "#FFFFFF" }
      }
    >
      <ProjectIconGlyph icon={icon} className={lg ? "size-5" : "size-4"} />
    </span>
  );
}

/** プロジェクト色のドット（ナビ・見出し用） */
export function ProjectDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}
