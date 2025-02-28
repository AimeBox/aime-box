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

interface MyThinkProps {
  children: ReactNode;
  [key: string]: any;
}

export interface MarkdownProps {
  value?: string;
}
const production = {
  Fragment: prod.Fragment,
  jsx: prod.jsx,
  jsxs: prod.jsxs,
  createElement: React.createElement,
};
export function Markdown(props: MarkdownProps) {
  const [renderedContent, setRenderedContent] = useState<string | null>(null);

  useEffect(() => {
    unified()
      .use(remarkParse)

      .use(rehypeReact, production)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkBreaks)
      .use(remarkRehype, { allowDangerousHtml: true })

      .use(rehypeRaw)
      .use(rehypeCodeTitles)
      .use(rehypeFormat)

      .use(rehypeMath)
      .use(rehypeKatex)
      .use(rehypeSanitize)
      .use(rehypeHighlight)

      .use(rehypeMermaid, { strategy: 'img-svg' })

      .use(rehypeStringify)

      //.use(rehypeSanitize)

      .process(props?.value)
      .then((res) => {
        setRenderedContent(res.toString());

        return null;
      })
      .catch((err) => {});
  }, [props?.value]);
  return (
    <>
      {renderedContent && (
        <div
          className="overflow-auto w-full max-w-max break-words prose dark:prose-invert dark prose-hr:m-0 prose-td:whitespace-pre-line"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
          key={props?.value}
        />
      )}
    </>
  );
}
