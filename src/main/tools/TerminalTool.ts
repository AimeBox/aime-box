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
import { FormSchema } from '@/types/form';

export interface TerminalToolParameters extends ToolParams {
  ask_human_input: boolean;
  defaultTerminal?: string;
}

export class TerminalTool extends BaseTool {
  schema = z.object(
    platform == 'win32'
      ? {
          command: z.string(),
          terminal: z.enum(['cmd.exe', 'pwsh.exe']).optional(),
        }
      : { command: z.string() },
  );

  name: string = 'terminal';

  description: string = `run ${platform == 'win32' ? 'Cmd or PowerShell' : 'bash'} command on ${platform} system.`;

  ask_human_input: boolean = false;

  terminale: string = platform == 'win32' ? 'cmd.exe' : 'bash';

  configSchema?: FormSchema[] = [
    {
      field: 'defaultTerminal',
      component: 'Select',
      label: 'Default Terminal',
      componentProps: {
        options: [
          {
            label: 'Cmd',
            value: 'cmd.exe',
          },
          {
            label: 'PowerShell',
            value: 'pwsh.exe',
          },
        ],
      },
    },
  ];

  constructor(params?: TerminalToolParameters) {
    super();
    const { ask_human_input, defaultTerminal } = params ?? {};
    this.ask_human_input = ask_human_input ?? false;
    if (platform == 'win32') {
      this.terminale = defaultTerminal || 'cmd.exe';
    } else {
      this.terminale = defaultTerminal || 'bash';
    }
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
        res = await runCommand(
          input.command as string,
          (input.terminal as string) || this.terminale,
        );
      } catch (err) {
        console.error(err);
        res = err.message;
      }
      return res;
    }

    //return null;
  }
}
