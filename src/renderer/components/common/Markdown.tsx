import React, { ReactNode, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { unified } from 'unified';
import remarkMath from 'remark-math';
import rehypeMath from 'rehype-math';
import remarkParse from 'remark-parse';
import rehypeStringify from 'rehype-stringify';
import remarkRehype from 'remark-rehype';
import remarkBreaks from 'remark-breaks';
import rehypeFormat from 'rehype-format';
import rehypeReact from 'rehype-react';
import rehypeMermaid from 'rehype-mermaid';
import * as prod from 'react/jsx-runtime';
import rehypeSanitize from 'rehype-sanitize';
import rehypeCodeTitles from 'rehype-code-titles';
import 'katex/dist/katex.min.css';

export interface MarkdownProps {
  value?: string;
}
const production = {
  Fragment: prod.Fragment,
  jsx: prod.jsx,
  jsxs: prod.jsxs,
  //createElement: React.createElement,
};

export function Markdown(props: MarkdownProps) {
  const [renderedContent, setRenderedContent] = useState<string | null>(null);
  const [thinkContent, setThinkContent] = useState<string | undefined>();

  useEffect(() => {
    const { thinkContent, restContent } = splitThinkTag(props?.value);

    setThinkContent(thinkContent);
    setRenderedContent(restContent);

    unified()
      .use(remarkParse, { fragment: true })

      .use(rehypeReact, production)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkBreaks)

      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw, true)
      .use(rehypeCodeTitles)
      .use(rehypeFormat)

      .use(rehypeMath)
      .use(rehypeKatex)
      //.use(rehypeSanitize)
      .use(rehypeHighlight)

      .use(rehypeMermaid, { strategy: 'inline-svg' })
      //.use(rehypeThink)
      .use(rehypeStringify)

      //.use(rehypeSanitize)

      .process(restContent)
      .then((res) => {
        const content = res.toString();
        setRenderedContent(content);
        return null;
      })
      .catch((err) => {});
  }, [props?.value]);

  function splitThinkTag(input: string): {
    thinkContent: string | null;
    restContent: string;
  } {
    const match = input.match(/^<think>([\s\S]*?)<\/think>\n\n/);
    if (match) {
      const thinkContent = match[1].trim(); // 提取 think 中的内容
      const restContent = input.slice(match[0].length); // 剩下的正文
      return { thinkContent, restContent };
    } else {
      return { thinkContent: null, restContent: input };
    }
  }

  useEffect(() => {}, [renderedContent]);
  return renderedContent ? (
    <>
      {thinkContent && (
        <div className="pl-2 mb-4 italic text-gray-500 whitespace-pre-wrap border-l-4 border-gray-300">
          {thinkContent}
        </div>
      )}
      <div
        className="overflow-auto w-full max-w-max break-words prose dark:prose-invert dark prose-hr:m-0 prose-td:whitespace-pre-line"
        dangerouslySetInnerHTML={{ __html: renderedContent }}
        key={renderedContent}
      />
    </>
  ) : null;
}
