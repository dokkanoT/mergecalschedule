// プロジェクトの色とアイコン（docs/SCREENS.md のデザイントークン）。
// 色は 6 色から選ぶ。薄い色（tint）は DB に持たず、ここから引く。
// アイコンは lucide-react のアイコン名（kebab-case）で持つ。画面側で部品に対応させる。

export const PROJECT_COLORS = [
  { key: "purple", label: "紫", color: "#7C5CFA", tint: "#F1EDFF" },
  { key: "orange", label: "オレンジ", color: "#F07B3F", tint: "#FFF0E7" },
  { key: "blue", label: "青", color: "#2F80ED", tint: "#EAF2FE" },
  { key: "green", label: "緑", color: "#1F9D6B", tint: "#E7F6EE" },
  { key: "pink", label: "ピンク", color: "#E0569B", tint: "#FDEBF4" },
  { key: "yellow", label: "黄", color: "#C98A0B", tint: "#FFF5DB" },
] as const;

export type ProjectColor = (typeof PROJECT_COLORS)[number]["color"];

export const DEFAULT_PROJECT_COLOR: ProjectColor = "#7C5CFA";

export function isProjectColor(value: string): value is ProjectColor {
  return PROJECT_COLORS.some((c) => c.color === value);
}

/** プロジェクト色に対応する薄い色。パレットにない色なら null */
export function tintOf(color: string): string | null {
  return PROJECT_COLORS.find((c) => c.color === color)?.tint ?? null;
}

/** 色の名前（スウォッチの aria-label 用） */
export function colorLabelOf(color: string): string | null {
  return PROJECT_COLORS.find((c) => c.color === color)?.label ?? null;
}

export const PROJECT_ICONS = [
  { key: "calendar", label: "カレンダー" },
  { key: "book-open", label: "本" },
  { key: "notebook-pen", label: "メモ" },
  { key: "beer", label: "ビール" },
  { key: "wine", label: "ワイン" },
  { key: "utensils", label: "食事" },
  { key: "smartphone", label: "スマホ" },
  { key: "code", label: "コード" },
  { key: "gamepad-2", label: "ゲーム" },
  { key: "music", label: "音楽" },
  { key: "camera", label: "カメラ" },
  { key: "map-pin", label: "地図" },
  { key: "shopping-cart", label: "買い物" },
  { key: "graduation-cap", label: "学校" },
  { key: "heart", label: "ハート" },
  { key: "rocket", label: "ロケット" },
] as const;

export type ProjectIcon = (typeof PROJECT_ICONS)[number]["key"];

export const DEFAULT_PROJECT_ICON: ProjectIcon = "calendar";

export function isProjectIcon(value: string): value is ProjectIcon {
  return PROJECT_ICONS.some((i) => i.key === value);
}
