"use client";

import { Copy } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

/** サイト内のパスを、いま開いている URL の origin 付きで表示してコピーする */
export function CopyLinkButton({ path }: { path: string }) {
  // サーバーでは origin が分からないので、ブラウザで描くときに読む
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState(false);
  const url = `${origin}${path}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-field bg-surface px-3 py-2 font-mono text-[13px] text-ink">
        {url}
      </code>
      <button
        type="button"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-field border border-border-strong bg-surface px-3 text-[13px] font-bold text-ink hover:bg-background"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        <Copy aria-hidden="true" strokeWidth={2} className="size-4" />
        {copied ? "コピーしました" : "リンクをコピー"}
      </button>
    </div>
  );
}

function noopSubscribe() {
  return () => {};
}
