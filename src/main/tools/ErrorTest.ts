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
import { ExcelLoader } from '../loaders/ExcelLoader';

export interface FileToTextParameters extends ToolParams {}

export class ErrorTest extends BaseTool {
  name: string = 'error_test';

  description: string = 'error test';

  constructor(params?: FileToTextParameters) {
    super(params);
  }

  schema = z.object({});

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    // 以50%概率抛出错误
    if (Math.random() < 0.5) {
      throw new Error('随机错误：这是一个测试错误');
    }
    return '操作成功，没有发生错误';
  }
}
