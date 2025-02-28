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

export interface CmdToolParameters extends ToolParams {
  ask_human_input: boolean;
}

export class CmdTool extends Tool {
  static lc_name() {
    return 'CmdTool';
  }

  name: string;

  description: string;

  ask_human_input: boolean = false;

  constructor(params?: CmdToolParameters) {
    super(params);
    const { ask_human_input } = params ?? {};
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'shell',
    });
    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'Run powershell commands on this windows machine.',
    });
    Object.defineProperty(this, 'ask_human_input', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: false,
    });

    this.ask_human_input = ask_human_input ?? false;
  }

  async _call(
    commands: string | string[],
    runManager,
    config,
  ): Promise<string> {
    console.log(`Executing command:\n ${commands}`);

    if (this.ask_human_input) {
      // if (user_input == 'y') {
      // }
      return null;
    } else {
      let res = [];
      if (isString(commands))
        if (process.platform == 'win32') {
          try {
            return await this.runWin32(commands);
          } catch (err) {
            return err;
          }
        } else if (isArray(commands)) {
        }
    }

    return null;
  }

  runWin32(commands: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        [commands],
        { encoding: 'buffer' },
        (error, stdout, stderr) => {
          const res_out = iconv.decode(stdout, 'cp936');
          const res_err = iconv.decode(stderr, 'cp936');
          if (error) {
            if (res_err) {
              reject(`Error:\n${res_err}`);
              return;
            }
            if (res_out) {
              reject(`${res_out}`);
              return;
            }
            return;
          }

          const out = iconv.decode(stdout, 'cp936');
          resolve(out);
          return;
        },
      );
    });
  }
}
