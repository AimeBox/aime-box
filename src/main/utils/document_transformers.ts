// import { Readability } from '@mozilla/readability';
// import { JSDOM } from 'jsdom';

import {
  MappingDocumentTransformer,
  Document,
} from '@langchain/core/documents';
// import TurndownService from 'turndown';
import settingsManager from '../settings';
import fetch from 'node-fetch';

export const htmlToMarkdown = async (
  doc: Document,
  options?: {
    debug?: boolean;
    maxElemsToParse?: number;
    nbTopCandidates?: number;
    charThreshold?: number;
    classesToPreserve?: string[];
    keepClasses?: boolean;
    disableJSONLD?: boolean;
    allowedVideoRegex?: RegExp;
  },
): Promise<Document> => {
  const url = `https://r.jina.ai/${doc.metadata.source}`;
  const res = await fetch(url, {
    method: 'GET',
  });
  const text = await res.text();

  const title = text.substring(7, text.indexOf('\n\nURL Source: '));
  const urlSource = text.substring(
    text.indexOf('\n\nURL Source: ') + '\n\nURL Source: '.length,
    text.indexOf('\n\nMarkdown Content:\n'),
  );
  const markdown = text.substring(
    text.indexOf('\n\nMarkdown Content:\n') + '\n\nMarkdown Content:\n'.length,
  );
  // const dom = new JSDOM(doc.pageContent);
  // const reader = new Readability(dom.window.document, options);
  // const result = reader.parse();

  // const turndownService = new TurndownService({
  //   codeBlockStyle: 'fenced',
  // });
  // const markdown = turndownService.turndown(result.content);
  // const name = result.title;
  return new Document({
    metadata: { title: title, source: urlSource },
    pageContent: markdown,
  });
};
export const urlToMarkdown = async (
  url: string,
  options?: {
    debug?: boolean;
    maxElemsToParse?: number;
    nbTopCandidates?: number;
    charThreshold?: number;
    classesToPreserve?: string[];
    keepClasses?: boolean;
    disableJSONLD?: boolean;
    allowedVideoRegex?: RegExp;
  },
): Promise<Document> => {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    method: 'GET',
    agent: await settingsManager.getHttpAgent(),
  });
  const text = await res.text();

  let title = text.substring(7, text.indexOf('\n\nURL Source: ')).trim();
  if (!title) {
    title = 'unkown';
  }
  const urlSource = text.substring(
    text.indexOf('\n\nURL Source: ') + '\n\nURL Source: '.length,
    text.indexOf('\n\nMarkdown Content:\n'),
  );
  const markdown = text.substring(
    text.indexOf('\n\nMarkdown Content:\n') + '\n\nMarkdown Content:\n'.length,
  );
  // const dom = new JSDOM(doc.pageContent);
  // const reader = new Readability(dom.window.document, options);
  // const result = reader.parse();

  // const turndownService = new TurndownService({
  //   codeBlockStyle: 'fenced',
  // });
  // const markdown = turndownService.turndown(result.content);
  // const name = result.title;
  return new Document({
    metadata: { title: title, source: urlSource },
    pageContent: markdown,
  });
};
