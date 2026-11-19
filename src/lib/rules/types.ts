/** ルール違反・入力エラー 1 件。message は画面にそのまま出す日本語 */
export type RuleIssue = {
  /** どの入力欄の問題か（フォームでエラーを出す位置） */
  field: string;
  message: string;
};
