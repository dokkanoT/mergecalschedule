import Link from "next/link";
import { secondaryButtonClass } from "@/components/common/buttons";
import { AuthCard } from "@/components/shell/auth-card";

// 存在しないページ・権限のないプロジェクト（メンバーでなければ、あることも知らせない）
export default function NotFound() {
  return (
    <AuthCard title="ページが見つかりません">
      <p className="text-[14px] text-ink-2">
        URL が間違っているか、ぼくのおともだちではない可能性があります。
      </p>
      <Link href="/board" className={`${secondaryButtonClass} w-full`}>
        チームボードへ
      </Link>
    </AuthCard>
  );
}
