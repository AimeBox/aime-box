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
import { BaseTool } from './BaseTool';

export interface FileToTextParameters extends ToolParams {}

export class FileToText extends BaseTool {
  name: string = 'file_to_text';

  description: string =
    'file convert to text support (pdf, docx, doc, pptx, txt, md)';

  constructor(params?: FileToTextParameters) {
    super(params);
  }

  schema = z.object({
    filePath: z.string().describe('file path'),
  });

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    try {
      if (!isString(input.filePath)) {
        return 'input value is not filePath';
      }
      if (!fs.existsSync(input.filePath)) {
        return 'file not found';
      }
      const ext = path.extname(input.filePath).toLowerCase();
      if (ext.toLowerCase() == '.pdf') {
        const loader = new PDFLoader(input.filePath);
        const docs = await loader.load();
        return docs.map((x) => x.pageContent).join('\n\n');
      } else if (ext.toLowerCase() == '.txt' || ext.toLowerCase() == '.md') {
        const loader = new TextLoader(input.filePath);
        const docs = await loader.load();
        return docs.map((x) => x.pageContent).join('\n\n');
      } else if (ext.toLowerCase() == '.docx') {
        const loader = new DocxLoader(input.filePath, { type: 'docx' });
        const docs = await loader.load();
        return docs.map((x) => x.pageContent).join('\n\n');
      } else if (ext.toLowerCase() == '.doc') {
        const loader = new DocxLoader(input.filePath, { type: 'doc' });
        const docs = await loader.load();
        return docs.map((x) => x.pageContent).join('\n\n');
      } else if (ext.toLowerCase() == '.pptx') {
        const loader = new PPTXLoader(input.filePath);
        const docs = await loader.load();
        return docs.map((x) => x.pageContent).join('\n\n');
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }
    } catch (err) {
      return JSON.stringify(err);
    }
    return null;
  }
}
