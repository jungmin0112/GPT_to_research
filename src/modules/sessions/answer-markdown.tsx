import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { SourceLink, httpUrl } from "@/shared/ui/source-link";
const plugins = [remarkGfm];
const components: Components = {
  a: ({ href, children }) => <SourceLink href={href}>{children}</SourceLink>,
  img: ({ alt }) => <span>{alt}</span>,
  table: ({ children }) => (
    <div
      className="answer-table"
      tabIndex={0}
      role="region"
      aria-label="답변 표"
    >
      <table>{children}</table>
    </div>
  ),
};

export const AnswerMarkdown = memo(function AnswerMarkdown({
  text,
}: {
  text: string;
}) {
  return (
    <div className="answer-markdown">
      <Markdown
        remarkPlugins={plugins}
        components={components}
        urlTransform={httpUrl}
        skipHtml
      >
        {text}
      </Markdown>
    </div>
  );
});
