import { Tool, ToolParams } from '@langchain/core/tools';
import ffmpeg from 'fluent-ffmpeg';

import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
} from 'child_process';
import { isArray, isString } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { PPTXLoader } from '@langchain/community/document_loaders/fs/pptx';

export interface FileToTextParameters extends ToolParams {}

export class FileToText extends Tool {
  static lc_name() {
    return 'FileToText';
  }

  name: string;

  description: string;

  constructor(params?: FileToTextParameters) {
    super(params);
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'file_to_text',
    });
    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'file convert to text',
    });
  }

  async _call(filePath: string, runManager, config): Promise<string> {
    try {
      if (!isString(filePath)) {
        return 'input value is not filePath';
      }
      const ext = path.extname(filePath).toLowerCase();
      if (ext.toLowerCase() == '.pdf') {
        const loader = new PDFLoader(filePath);
        const docs = await loader.load();
        return docs.map((x) => x.pageContent).join('\n\n');
      } else if (ext.toLowerCase() == '.txt') {
        const loader = new TextLoader(filePath);
        const docs = await loader.load();
        return docs.map((x) => x.pageContent).join('\n\n');
      } else if (ext.toLowerCase() == '.docx') {
        const loader = new DocxLoader(filePath, { type: 'docx' });
        const docs = await loader.load();
        return docs.map((x) => x.pageContent).join('\n\n');
      } else if (ext.toLowerCase() == '.doc') {
        const loader = new DocxLoader(filePath, { type: 'doc' });
        const docs = await loader.load();
        return docs.map((x) => x.pageContent).join('\n\n');
      } else if (ext.toLowerCase() == '.pptx') {
        const loader = new PPTXLoader(filePath);
        const docs = await loader.load();
        return docs.map((x) => x.pageContent).join('\n\n');
      }
    } catch (err) {
      return JSON.stringify(err);
    }
    return null;
  }
}
