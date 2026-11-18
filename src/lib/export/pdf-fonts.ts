import "server-only";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

export const PDF_FONT_FAMILY = "NotoSansJP";

let registered = false;

/** 日本語フォントを登録する。PDF を作る前に必ず呼ぶ（文字化けしたらまずここを疑う）。 */
export function registerPdfFonts() {
  if (registered) return;
  const dir = path.join(process.cwd(), "public", "fonts");
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: path.join(dir, "NotoSansJP-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "NotoSansJP-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // 日本語は単語区切りがないので、自動ハイフネーションを無効にする
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
