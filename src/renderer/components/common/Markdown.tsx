import React, { createElement, ReactNode, useEffect, useState } from 'react';
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
import { ChatInputAttachment } from '@/types/chat';
import ChatAttachment from '../chat/ChatAttachment';
import { marked } from 'marked';
import rehypeMathjax from 'rehype-mathjax/browser';
import { visit } from 'unist-util-visit';
import { isString } from '@/main/utils/is';
import { splitContextAndFiles } from '@/renderer/utils/ContentUtils';
import { cn } from '@/lib/utils';

export interface MarkdownProps {
  value?: string;
  className?: string;
}
const production = {
  Fragment: prod.Fragment,
  jsx: prod.jsx,
  jsxs: prod.jsxs,
  //createElement: React.createElement,
};
function remarkEncodeLinks() {
  return (tree) => {
    visit(tree, 'link', (node) => {
      if (typeof node.url === 'string') {
        node.url = node.url.replace(/ /g, '%20');
      }
    });
  };
}

export function Markdown(props: MarkdownProps) {
  const [renderedContent, setRenderedContent] = useState<string | null>(null);
  const [thinkContent, setThinkContent] = useState<string | undefined>();
  const [files, setFiles] = useState<ChatInputAttachment[]>([]);

  useEffect(() => {
    const { thinkContent, restContent } = splitThinkTag(props?.value);
    const { context, attachments } = splitContextAndFiles(restContent);

    setFiles(attachments);
    setThinkContent(thinkContent);
    // setRenderedContent(context);

    unified()
      .use(remarkParse, { fragment: true })
      //.use(remarkEncodeLinks)
      .use(remarkGfm)
      .use(rehypeMathjax)
      .use(remarkBreaks)

      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeReact, production)
      .use(rehypeRaw, true)
      .use(rehypeCodeTitles)
      .use(rehypeFormat)

      // .use(rehypeMath)
      // .use(rehypeKatex)
      //.use(rehypeSanitize)
      .use(rehypeHighlight)

      .use(rehypeMermaid, { strategy: 'inline-svg' })
      //.use(rehypeThink)
      .use(rehypeStringify)

      //.use(rehypeSanitize)

      .process(context)
      .then((res) => {
        const _html = res.toString();
        setRenderedContent(_html);
        return null;
      })
      .catch((err) => {});
  }, [props?.value]);

  function splitThinkTag(input: string): {
    thinkContent: string | null;
    restContent: string;
  } {
    if (input && isString(input)) {
      const match = input.match(/^<think>([\s\S]*?)<\/think>\n\n/);
      if (match) {
        const thinkContent = match[1].trim(); // 提取 think 中的内容
        const restContent = input.slice(match[0].length); // 剩下的正文
        return { thinkContent, restContent };
      } else {
        return { thinkContent: null, restContent: input };
      }
    }
    return { thinkContent: null, restContent: '' };
  }

  // useEffect(() => {}, [renderedContent]);
  return thinkContent || renderedContent || (files && files.length > 0) ? (
    <>
      {thinkContent && (
        <div className="pl-2 mb-4 italic text-gray-500 whitespace-pre-wrap border-l-4 border-gray-300">
          {thinkContent}
        </div>
      )}
      <div
        className={cn(
          'w-full text-sm break-all max-w-max break-words prose dark:prose-invert dark prose-hr:m-0 prose-td:whitespace-pre-line min-w-[100%]',
          props?.className,
        )}
        dangerouslySetInnerHTML={{ __html: renderedContent }}
        key={renderedContent}
      />
      {files && files.length > 0 && (
        <div className="flex flex-wrap gap-2 p-1">
          {files.map((file) => {
            return (
              <ChatAttachment
                value={file}
                key={file.path}
                showPreview
              ></ChatAttachment>
            );
          })}
        </div>
      )}
    </>
  ) : null;
}
