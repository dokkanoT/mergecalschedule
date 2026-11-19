import type { Metadata } from "next";
import { JetBrains_Mono, Noto_Sans_JP, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

// 日本語フォントはファイルが大きいので preload しない（表示しながら読み込む）
const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  weight: ["400", "500", "700"],
  preload: false,
});

const zenMaruGothic = Zen_Maru_Gothic({
  variable: "--font-zen-maru-gothic",
  weight: ["700"],
  preload: false,
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "マジスケ",
  description: "身内デベロッパーのための、プロジェクト横断スケジュール管理",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${notoSansJp.variable} ${zenMaruGothic.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
