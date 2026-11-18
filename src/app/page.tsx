import { redirect } from "next/navigation";

// ログイン後の初期画面はメンバーボード。未ログインなら proxy / board 側で /login へ送る。
export default function Home() {
  redirect("/board");
}
