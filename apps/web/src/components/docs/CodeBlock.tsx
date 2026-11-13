'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CodeBlock({
  title,
  lang,
  code
}: {
  title: string;
  lang: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#1E293B] bg-[#0B0F17] text-slate-100 shadow-xs">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3.5 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 rounded bg-[#1F3CFF]/25 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#93C5FD]">
            {lang}
          </span>
          <span className="truncate font-mono text-[11px] text-slate-300">{title}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-[10px] font-semibold text-slate-200 hover:bg-white/10"
        >
          {copied ? <Check className="h-3 w-3 text-[#34D399]" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

