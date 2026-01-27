"use client";

import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownPreviewProps = {
  content: string;
  className?: string;
};

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  if (!content?.trim()) {
    return null;
  }

  return (
    <div
      className={clsx(
        "prose prose-sm prose-invert max-w-none text-slate-100 [&>*]:text-inherit [&_strong]:text-white",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
