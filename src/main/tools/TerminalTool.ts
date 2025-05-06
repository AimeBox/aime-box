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

export interface TerminalToolParameters extends ToolParams {
  ask_human_input: boolean;
}

export class TerminalTool extends BaseTool {
  schema = z.object({
    command: z.string(),
  });

  name: string = 'terminal';

  description: string = `run ${platform == 'win32' ? 'cmd.exe' : 'bash'} commands on ${platform} system.`;

  ask_human_input: boolean = false;

  constructor(params?: TerminalToolParameters) {
    super();
    const { ask_human_input } = params ?? {};
    this.ask_human_input = ask_human_input ?? false;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    console.log(`Executing command:\n ${input.command}`);

    if (this.ask_human_input) {
      // if (user_input == 'y') {
      // }
      return null;
    } else {
      let res;
      try {
        res = await runCommand(input.command as string);
      } catch (err) {
        console.error(err);
        res = err.message;
      }
      return res;
    }

    //return null;
  }
}
