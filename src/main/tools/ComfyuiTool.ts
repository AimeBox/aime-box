import { Tool, ToolParams } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
} from 'child_process';
import { is, isArray, isString } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path from 'path';
import { app } from 'electron';
import { PythonShell, Options } from 'python-shell';
import fs from 'fs';
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';

export interface ComfyuiToolParameters extends ToolParams {
  defaultApiBase?: string;
}

export class ComfyuiTool extends BaseTool {
  schema = z.object({
    fileOrCode: z.string().describe('The file or code to run'),
  });

  configSchema: FormSchema[] = [
    {
      label: 'defaultApiBase',
      field: 'defaultApiBase',
      component: 'Input',
      defaultValue: 'http://127.0.0.1:8188',
    },
  ];

  static lc_name() {
    return this.name;
  }

  name: string = 'comfyui_tool';

  description: string = `comfyui workflow.`;

  defaultApiBase: string = 'http://127.0.0.1:8188';

  constructor(params?: ComfyuiToolParameters) {
    super(params);
    this.defaultApiBase = params?.defaultApiBase;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    if (!this.defaultApiBase) {
      return 'not found';
    }

    return null;
  }
}
