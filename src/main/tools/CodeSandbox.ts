import { Tool, ToolParams, StructuredTool } from '@langchain/core/tools';
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

import {
  DallEAPIWrapper,
  DallEAPIWrapperParams,
  OpenAIClient,
  ClientOptions,
} from '@langchain/openai';
import { BaseTool, ToolTag } from './BaseTool';
import { FormSchema } from '@/types/form';
import { base64ToFile, downloadFile, saveFile } from '../utils/common';
import { getTmpPath } from '../utils/path';
import { v4 as uuidv4 } from 'uuid';

export interface CodeSandboxParameters extends ToolParams {}

export class CodeSandbox extends BaseTool {
  schema = z.object({
    path: z
      .string()
      .describe('The path to the project must be a folder path')
      .default('./'),
    entry: z.string().default('project enrty eg. "/src/main.js"'),
  });

  configSchema?: FormSchema[] = [];

  name: string = 'code_sandbox';

  description: string = 'show the react project preview';

  constructor(params?: CodeSandboxParameters) {
    super(params);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    return `done`;
  }
}
