import {
  ToolParams,
  ToolRunnableConfig,
  ToolSchemaBase,
} from '@langchain/core/tools';
import { BaseTool } from './BaseTool';
import { z } from 'zod';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { FormSchema } from '@/types/form';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';
import stripAnsi from 'strip-ansi';
import fs from 'fs';
import crypto from 'crypto';
import { truncateText } from '../utils/common';

export interface BashToolParameters extends ToolParams {
  maxTimeout?: number;
}

const BASH_MAX_TIMEOUT_MS = 1000 * 60 * 3;

export class BashTool extends BaseTool {
  static readonly Name = 'bash';

  name = 'bash';

  description = 'The command to execute';

  maxTimeout: number;

  schema = z.strictObject({
    command: z.string().describe('The command to run'),
    timeout: z
      .number()
      .optional()
      .describe(
        `Optional timeout in milliseconds (max ${BASH_MAX_TIMEOUT_MS})`,
      ),
    description: z.string().optional()
      .describe(` Clear, concise description of what this command does in 5-10 words. Examples:
Input: ls
Output: Lists files in current directory

Input: git status
Output: Shows working tree status

Input: npm install
Output: Installs package dependencies

Input: mkdir foo
Output: Creates directory 'foo'`),
    directory: z
      .string()
      .optional()
      .describe('The directory to run the command in'),
  });

  configSchema: FormSchema[] = [
    {
      label: 'Max Timeout (ms)',
      field: 'maxTimeout',
      component: 'InputNumber',
      defaultValue: BASH_MAX_TIMEOUT_MS,
      componentProps: {
        min: 10000,
      },
      required: false,
    },
  ];

  constructor(fields?: BashToolParameters) {
    super(fields);
    this.maxTimeout = fields?.maxTimeout || BASH_MAX_TIMEOUT_MS;
  }

  getMaxTimeout() {
    return this.maxTimeout;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    const { timeout, description, directory } = input;
    const isWindows = os.platform() === 'win32';

    let cwd;
    const workspace = config?.configurable?.workspace;

    const abortSignal = config?.signal;

    if (input.directory) {
      if (!fs.existsSync(input.directory)) {
        throw new Error(`Directory ${input.directory} does not exist`);
      }
      if (
        fs.existsSync(input.directory) &&
        !fs.statSync(input.directory).isDirectory()
      ) {
        throw new Error(`Directory ${input.directory} is not a directory`);
      }
    }
    if (input.directory) {
      cwd = input.directory;
    } else {
      cwd = workspace;
    }

    const tempFileName = `shell_pgrep_${crypto
      .randomBytes(6)
      .toString('hex')}.tmp`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

    // pgrep is not available on Windows, so we can't get background PIDs
    const command = isWindows
      ? input.command
      : (() => {
          // wrap command to append subprocess pids (via pgrep) to temporary file
          let command = input.command.trim();
          if (!command.endsWith('&')) command += ';';
          return `{ ${command} }; __code=$?; pgrep -g 0 >${tempFilePath} 2>&1; exit $__code;`;
        })();

    const shell = isWindows
      ? spawn('cmd.exe', ['/c', command], {
          stdio: ['ignore', 'pipe', 'pipe'],
          // detached: true, // ensure subprocess starts its own process group (esp. in Linux)
          cwd: cwd,
          timeout: timeout,
          env: {
            ...process.env,
          },
        })
      : spawn('bash', ['-c', command], {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true, // ensure subprocess starts its own process group (esp. in Linux)
          cwd: cwd,
          timeout: timeout,
          env: {
            ...process.env,
          },
        });

    let exited = false;
    let stdout = '';
    let output = '';
    let lastUpdateTime = Date.now();

    const appendOutput = (str: string) => {
      output += str;
    };

    shell.stdout.on('data', (data: Buffer) => {
      // continue to consume post-exit for background processes
      // removing listeners can overflow OS buffer and block subprocesses
      // destroying (e.g. shell.stdout.destroy()) can terminate subprocesses via SIGPIPE
      if (!exited) {
        const str = stripAnsi(data.toString());
        stdout += str;
        appendOutput(str);
      }
    });

    let stderr = '';
    shell.stderr.on('data', (data: Buffer) => {
      if (!exited) {
        const str = stripAnsi(data.toString());
        stderr += str;
        appendOutput(str);
      }
    });

    let error: Error | null = null;
    shell.on('error', (err: Error) => {
      error = err;
      // remove wrapper from user's command in error message
      error.message = error.message.replace(command, input.command);
    });

    let code: number | null = null;
    let processSignal: NodeJS.Signals | null = null;
    const exitHandler = (
      _code: number | null,
      _signal: NodeJS.Signals | null,
    ) => {
      exited = true;
      code = _code;
      processSignal = _signal;
    };
    shell.on('exit', exitHandler);

    const abortHandler = async () => {
      if (shell.pid && !exited) {
        if (os.platform() === 'win32') {
          // For Windows, use taskkill to kill the process tree
          spawn('taskkill', ['/pid', shell.pid.toString(), '/f', '/t']);
        } else {
          try {
            // attempt to SIGTERM process group (negative PID)
            // fall back to SIGKILL (to group) after 200ms
            process.kill(-shell.pid, 'SIGTERM');
            await new Promise((resolve) => setTimeout(resolve, 200));
            if (shell.pid && !exited) {
              process.kill(-shell.pid, 'SIGKILL');
            }
          } catch (_e) {
            // if group kill fails, fall back to killing just the main process
            try {
              if (shell.pid) {
                shell.kill('SIGKILL');
              }
            } catch (_e) {
              console.error(`failed to kill shell process ${shell.pid}: ${_e}`);
            }
          }
        }
      }
    };
    abortSignal?.addEventListener('abort', abortHandler);

    // wait for the shell to exit
    try {
      await new Promise((resolve) => shell.on('exit', resolve));
    } finally {
      abortSignal?.removeEventListener('abort', abortHandler);
    }

    const backgroundPIDs: number[] = [];
    if (os.platform() !== 'win32') {
      if (fs.existsSync(tempFilePath)) {
        const pgrepLines = fs
          .readFileSync(tempFilePath, 'utf8')
          .split('\n')
          .filter(Boolean);
        for (const line of pgrepLines) {
          if (!/^\d+$/.test(line)) {
            console.error(`pgrep: ${line}`);
          }
          const pid = Number(line);
          // exclude the shell subprocess pid
          if (pid !== shell.pid) {
            backgroundPIDs.push(pid);
          }
        }
        fs.unlinkSync(tempFilePath);
      } else {
        if (abortSignal?.aborted === false) {
          console.error('missing pgrep output');
        }
      }
    }

    let llmContent = '';
    if (abortSignal?.aborted) {
      llmContent = 'Command was cancelled by user before it could complete.';
      if (output.trim()) {
        output = output.trim();

        if (output && output.length > 2000) {
          output = truncateText(output, 1000);
        }
        llmContent += ` Below is the output (on stdout and stderr) before it was cancelled:\n${output}`;
      } else {
        llmContent += ' There was no output before it was cancelled.';
      }
    } else {
      if (stdout && stdout.length > 2000) {
        stdout = truncateText(stdout, 1000);
      }
      let errorMessage = error?.toString();
      if (errorMessage && errorMessage.length > 2000) {
        errorMessage = truncateText(errorMessage, 1000);
      }
      llmContent = [
        `Command: ${command}`,
        `Directory: ${directory || '(root)'}`,
        `Stdout: ${stdout || '(empty)'}`,
        `Stderr: ${stderr || '(empty)'}`,
        `Error: ${errorMessage ?? '(none)'}`,
        `Exit Code: ${code ?? '(none)'}`,
        `Signal: ${processSignal ?? '(none)'}`,
        `Background PIDs: ${backgroundPIDs.length ? backgroundPIDs.join(', ') : '(none)'}`,
        `Process Group PGID: ${shell.pid ?? '(none)'}`,
      ].join('\n');
    }

    return llmContent;
  }
}
