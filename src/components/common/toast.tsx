"use client";

import { useEffect, useState } from "react";

/** 右下に 2 秒だけ出る通知（SCREENS.md §6 保存成功） */
export function Toast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(id);
  }, []);
  if (!visible) return null;
  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 rounded-field bg-ink px-4 py-3 text-[14px] font-medium text-white"
    >
      {message}
    </div>
  );
}
