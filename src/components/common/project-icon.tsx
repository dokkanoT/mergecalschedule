import { createElement } from "react";
import {
  BookOpen,
  Calendar,
  Camera,
  Code,
  Gamepad2,
  GraduationCap,
  Heart,
  type LucideIcon,
  type LucideProps,
  MapPin,
  Music,
  NotebookPen,
  Rocket,
  ShoppingCart,
  Smartphone,
  Utensils,
  Wine,
  Beer,
} from "lucide-react";
import { DEFAULT_PROJECT_ICON, type ProjectIcon } from "@/lib/project-style";

// src/lib/project-style の PROJECT_ICONS と同じ並び・同じキー
const ICONS: Record<ProjectIcon, LucideIcon> = {
  calendar: Calendar,
  "book-open": BookOpen,
  "notebook-pen": NotebookPen,
  beer: Beer,
  wine: Wine,
  utensils: Utensils,
  smartphone: Smartphone,
  code: Code,
  "gamepad-2": Gamepad2,
  music: Music,
  camera: Camera,
  "map-pin": MapPin,
  "shopping-cart": ShoppingCart,
  "graduation-cap": GraduationCap,
  heart: Heart,
  rocket: Rocket,
};

/** プロジェクトのアイコン（lucide のアイコン名から描く。一覧にない名前ならカレンダー） */
export function ProjectIconGlyph({ icon, ...props }: { icon: string } & LucideProps) {
  return createElement(ICONS[icon as ProjectIcon] ?? ICONS[DEFAULT_PROJECT_ICON], { strokeWidth: 2, ...props });
}
