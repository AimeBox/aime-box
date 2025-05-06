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
import { ChatInputAttachment } from '@/types/chat';
import ChatAttachment from '../chat/ChatAttachment';
import { marked } from 'marked';

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
  const [files, setFiles] = useState<ChatInputAttachment[]>([]);
  function splitContextAndFiles(input: string): {
    context: string;
    attachments: ChatInputAttachment[];
  } {
    const attachments: ChatInputAttachment[] = [];
    const fileRegex = /<file>([\s\S]*?)<\/file>/g;
    let match: RegExpExecArray | null;

    // 提取所有 <file>xxx</file> 内容
    while ((match = fileRegex.exec(input)) !== null) {
      const attachment = parseMarkdownFileLink(match[1], 'file');
      if (attachment) {
        attachments.push(attachment);
      }
    }

    // 去掉所有 <file>...</file> 后，剩下的就是 context
    let context = input.replace(fileRegex, '').trim();

    const folderRegex = /<folder>([\s\S]*?)<\/folder>/g;
    while ((match = folderRegex.exec(input)) !== null) {
      const attachment = parseMarkdownFileLink(match[1], 'folder');
      if (attachment) {
        attachments.push(attachment);
      }
    }
    context = context.replace(folderRegex, '').trim();

    return { context, attachments: attachments };
  }
  function parseMarkdownFileLink(
    md: string,
    type: 'file' | 'folder',
  ): ChatInputAttachment | undefined {
    const match = md.match(/\[([^\]]+?)\]\((.+?)\)$/);
    const tokens = marked.lexer(md);
    if (tokens.length == 1) {
      const linkToken = tokens
        .at(0)
        ?.tokens.find((token) => token.type === 'link');
      if (linkToken) {
        console.log(linkToken);
        const name = linkToken.text;
        const path = linkToken.href;
        const ext = `.${name.split('.').pop()}`;
        return {
          name,
          path,
          type: 'file',
          ext: ext,
        };
      }
    }

    return undefined;
  }

  useEffect(() => {
    const { thinkContent, restContent } = splitThinkTag(props?.value);
    const { context, attachments } = splitContextAndFiles(restContent);
    setFiles(attachments);
    setThinkContent(thinkContent);
    setRenderedContent(context);

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

      .process(context)
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
      <div className="flex flex-wrap gap-2 p-1">
        {files.map((file) => {
          return <ChatAttachment value={file} key={file.path}></ChatAttachment>;
        })}
      </div>
    </>
  ) : null;
}
