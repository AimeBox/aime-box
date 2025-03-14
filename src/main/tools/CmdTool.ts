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

export interface CmdToolParameters extends ToolParams {
  ask_human_input: boolean;
}

export class CmdTool extends BaseTool {
  static lc_name() {
    return 'cmd';
  }

  schema = z.object({
    commands: z.string(),
  });

  name: string = 'cmd';

  description: string = 'run cmd commands on windows system.';

  ask_human_input: boolean = false;

  constructor(params?: CmdToolParameters) {
    super();
    const { ask_human_input } = params ?? {};
    this.ask_human_input = ask_human_input ?? false;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    console.log(`Executing command:\n ${input.commands}`);

    if (this.ask_human_input) {
      // if (user_input == 'y') {
      // }
      return null;
    } else {
      let res;
      try {
        res = await runCommand(input.commands as string);
      } catch (err) {
        console.error(err);
        res = err.message;
      }
      return res;
    }

    return null;
  }
}
