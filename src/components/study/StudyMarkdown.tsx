import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { preprocessMarkdown } from "@/lib/utils";

export default function StudyMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none [&_br]:block [&_br]:my-1">
      <ReactMarkdown remarkPlugins={[remarkMath, remarkBreaks]} rehypePlugins={[rehypeKatex]}>
        {preprocessMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
}
