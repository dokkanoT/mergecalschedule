import { Document, Page, StyleSheet, Text, renderToBuffer } from "@react-pdf/renderer";
import { PDF_FONT_FAMILY, registerPdfFonts } from "@/lib/export/pdf-fonts";

// 環境構築時の確認用：日本語1行だけの PDF を返す（タスク11で本実装に置き換える）
export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: PDF_FONT_FAMILY, fontSize: 18 },
});

export async function GET() {
  registerPdfFonts();
  const buffer = await renderToBuffer(
    <Document title="マジスケ PDF テスト">
      <Page size="A4" style={styles.page}>
        <Text>マジスケ：日本語の PDF 出力テストです。</Text>
      </Page>
    </Document>,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent("PDFテスト.pdf")}`,
    },
  });
}
