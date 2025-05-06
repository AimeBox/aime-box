import { Tool, ToolParams } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
  execFile,
} from 'child_process';
import { isArray, isString } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import { runCommand } from '../utils/exec';
import { BaseTool } from './BaseTool';
import { platform } from 'process';

export interface SleepToolParameters extends ToolParams {
  ask_human_input: boolean;
}

export class SleepTool extends BaseTool {
  schema = z.object({
    seconds: z.number(),
  });

  name: string = 'sleep';

  description: string = `sleep for a while`;

  constructor(params?: SleepToolParameters) {
    super();
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const seconds = input.seconds < 0 ? 5 : input.seconds;
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

    return `sleep ${seconds} seconds done`;
  }
}
