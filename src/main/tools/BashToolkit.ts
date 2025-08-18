import {
  BaseToolkit,
  StructuredToolInterface,
  ToolParams,
  ToolRunnableConfig,
  ToolSchemaBase,
} from '@langchain/core/tools';
import { BaseTool, BaseToolKit } from './BaseTool';
import { z } from 'zod';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { FormSchema } from '@/types/form';
import path from 'path';
import { ChildProcessByStdio, spawn } from 'child_process';
import os from 'os';
import stripAnsi from 'strip-ansi';
import fs from 'fs';
import crypto from 'crypto';
import { truncateText } from '../utils/common';
import Stream from 'stream';
import { t } from 'i18next';

export interface BashToolParameters extends ToolParams {
  maxTimeout?: number;
}

const BASH_MAX_TIMEOUT_MS = 1000 * 60 * 10;
const MAX_OUTPUT_LENGTH = 2000;

const createShell = (input_command: string, cwd?: string, timeout?: number) => {
  const isWindows = os.platform() === 'win32';
  const tempFileName = `shell_pgrep_${crypto
    .randomBytes(6)
    .toString('hex')}.tmp`;
  const tempFilePath = path.join(os.tmpdir(), tempFileName);

  // pgrep is not available on Windows, so we can't get background PIDs
  const _command = isWindows
    ? input_command
    : (() => {
        // wrap command to append subprocess pids (via pgrep) to temporary file
        let command = input_command.trim();
        if (!command.endsWith('&')) command += ';';
        return `{ ${command} }; __code=$?; pgrep -g 0 >${tempFilePath} 2>&1; exit $__code;`;
      })();

  const shell = isWindows
    ? spawn('cmd.exe', ['/c', _command], {
        stdio: ['ignore', 'pipe', 'pipe'],
        // detached: true, // ensure subprocess starts its own process group (esp. in Linux)
        cwd: cwd,
        timeout: timeout,
        env: {
          ...process.env,
        },
      })
    : spawn('bash', ['-c', _command], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true, // ensure subprocess starts its own process group (esp. in Linux)
        cwd: cwd,
        timeout: timeout,
        env: {
          ...process.env,
        },
      });
  return { shell, tempFilePath, command: _command };
};

export class BashTool extends BaseTool {
  static readonly Name = 'bash';

  toolKitName: string = 'bash_toolkit';

  name = 'bash';

  description = `Executes a given bash command in a persistent shell session with optional timeout, ensuring proper handling and security measures.

Before executing the command, please follow these steps:

1. Directory Verification:

- If the command will create new directories or files, first use the 'list_directory' tool to verify the parent directory exists and is the correct location
- For example, before running "mkdir foo/bar", first use 'list_directory' to check that "foo" exists and is the intended parent directory

2. Command Execution:

- Always quote file paths that contain spaces with double quotes (e.g., cd "path with spaces/file.txt")
- Examples of proper quoting:
- cd "/Users/name/My Documents" (correct)
- cd /Users/name/My Documents (incorrect - will fail)
- python "/path/with spaces/script.py" (correct)
- python /path/with spaces/script.py (incorrect - will fail)
- After ensuring proper quoting, execute the command.
- Capture the output of the command.

Usage notes:

- The command argument is required.
- You can specify an optional timeout in milliseconds (up to ${BASH_MAX_TIMEOUT_MS}ms / ${BASH_MAX_TIMEOUT_MS / 1000 / 60} minutes). If not specified, commands will timeout after 120000ms (2 minutes).
- It is very helpful if you write a clear, concise description of what this command does in 5-10 words.
- If the output exceeds ${MAX_OUTPUT_LENGTH} characters, output will be truncated before being returned to you.
- You can use the \`run_in_background\` parameter to run the command in the background, which allows you to continue working while the command runs. You can monitor the output using the 'bash' tool as it becomes available. Never use \`run_in_background\` to run 'sleep' as it will return immediately. You do not need to use '&' at the end of the command when using this parameter.
- VERY IMPORTANT: You MUST avoid using search commands like \`find\` and \`grep\`. Instead use 'grep', 'glob', or 'task' to search. You MUST avoid read tools like \`cat\`, \`head\`, \`tail\`, and \`ls\`, and use 'file_read' and 'list_directory' to read files.
- If you _still_ need to run \`grep\`, STOP. ALWAYS USE ripgrep at \`rg\` first, which all Claude Code users have pre-installed.
- When issuing multiple commands, use the ';' or '&&' operator to separate them. DO NOT use newlines (newlines are ok in quoted strings).
- Try to maintain your current working directory throughout the session by using absolute paths and avoiding usage of \`cd\`. You may use \`cd\` if the User explicitly requests it.
  <good-example>
  pytest /foo/bar/tests
  </good-example>
  <bad-example>
  cd /foo/bar && pytest tests
  </bad-example>

# Committing changes with git

When the user asks you to create a new git commit, follow these steps carefully:

1. You have the capability to call multiple tools in a single response. When multiple independent pieces of information are requested, batch your tool calls together for optimal performance. ALWAYS run the following bash commands in parallel, each using the Bash tool:

- Run a git status command to see all untracked files.
- Run a git diff command to see both staged and unstaged changes that will be committed.
- Run a git log command to see recent commit messages, so that you can follow this repository's commit message style.

2. Analyze all staged changes (both previously staged and newly added) and draft a commit message:

- Summarize the nature of the changes (eg. new feature, enhancement to an existing feature, bug fix, refactoring, test, docs, etc.). Ensure the message accurately reflects the changes and their purpose (i.e. "add" means a wholly new feature, "update" means an enhancement to an existing feature, "fix" means a bug fix, etc.).
- Check for any sensitive information that shouldn't be committed
- Draft a concise (1-2 sentences) commit message that focuses on the "why" rather than the "what"
- Ensure it accurately reflects the changes and their purpose

3. You have the capability to call multiple tools in a single response. When multiple independent pieces of information are requested, batch your tool calls together for optimal performance. ALWAYS run the following commands in parallel:

- Run git status to make sure the commit succeeded.

4. If the commit fails due to pre-commit hook changes, retry the commit ONCE to include these automated changes. If it fails again, it usually means a pre-commit hook is preventing the commit. If the commit succeeds but you notice that files were modified by the pre-commit hook, you MUST amend your commit to include them.

Important notes:

- NEVER update the git config
- NEVER run additional commands to read or explore code, besides git bash commands
- NEVER use the 'todo_write' or 'task' tools
- DO NOT push to the remote repository unless the user explicitly asks you to do so
- IMPORTANT: Never use git commands with the -i flag (like git rebase -i or git add -i) since they require interactive input which is not supported.
- If there are no changes to commit (i.e., no untracked files and no modifications), do not create an empty commit
- In order to ensure good formatting, ALWAYS pass the commit message via a HEREDOC, a la this example:
  <example>
  git commit -m "$(cat <<'EOF'
  Commit message here.
  EOF
  )"
  </example>

# Creating pull requests

Use the gh command via the 'bash' tool for ALL GitHub-related tasks including working with issues, pull requests, checks, and releases. If given a Github URL use the gh command to get the information needed.

IMPORTANT: When the user asks you to create a pull request, follow these steps carefully:

1. You have the capability to call multiple tools in a single response. When multiple independent pieces of information are requested, batch your tool calls together for optimal performance. ALWAYS run the following bash commands in parallel using the 'bash' tool, in order to understand the current state of the branch since it diverged from the main branch:
   - Run a git status command to see all untracked files
   - Run a git diff command to see both staged and unstaged changes that will be committed
   - Check if the current branch tracks a remote branch and is up to date with the remote, so you know if you need to push to the remote
   - Run a git log command and \`git diff [base-branch]...HEAD\` to understand the full commit history for the current branch (from the time it diverged from the base branch)
2. Analyze all changes that will be included in the pull request, making sure to look at all relevant commits (NOT just the latest commit, but ALL commits that will be included in the pull request!!!), and draft a pull request summary
3. You have the capability to call multiple tools in a single response. When multiple independent pieces of information are requested, batch your tool calls together for optimal performance. ALWAYS run the following commands in parallel:
   - Create new branch if needed
   - Push to remote with -u flag if needed
   - Create PR using gh pr create with the format below. Use a HEREDOC to pass the body to ensure correct formatting.
     <example>
     gh pr create --title "the pr title" --body "$(cat <<'EOF'

## Summary

<1-3 bullet points>

## Test plan

[Checklist of TODOs for testing the pull request...]

EOF
)"
</example>

Important:

- NEVER update the git config
- DO NOT use the 'todo_write' or 'task' tools
- Return the PR URL when you're done, so the user can see it

# Other common operations

- View comments on a Github PR: gh api repos/foo/bar/pulls/123/comments
`;

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
    run_in_background: z
      .boolean()
      .optional()
      .describe(
        'Set to true to run this command in the background. Use "bash_output" tool to read the output later.',
      ),
  });

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

    if (input.run_in_background) {
      const bash_id = crypto.randomBytes(4).toString('hex');
      bashManager.runInBackground(
        { command: input.command },
        bash_id,
        cwd,
        timeout,
      );
      return `Command running in background with ID: ${bash_id}`;
    }

    const { shell, tempFilePath, command } = createShell(
      input.command,
      cwd,
      timeout,
    );

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

        if (output && output.length > MAX_OUTPUT_LENGTH) {
          output = truncateText(output, MAX_OUTPUT_LENGTH / 2);
        }
        llmContent += ` Below is the output (on stdout and stderr) before it was cancelled:\n${output}`;
      } else {
        llmContent += ' There was no output before it was cancelled.';
      }
    } else {
      if (stdout && stdout.length > MAX_OUTPUT_LENGTH) {
        stdout = truncateText(stdout, 1000);
      }
      let errorMessage = error?.toString();
      if (errorMessage && errorMessage.length > MAX_OUTPUT_LENGTH) {
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

export class BashOutputTool extends BaseTool {
  static readonly Name = 'bash_output';

  toolKitName: string = 'bash_toolkit';

  name = 'bash_output';

  description = `- Retrieves output from a running or completed background bash shell
- Takes a shell_id parameter identifying the shell
- Always returns only new output since the last check
- Returns stdout and stderr output along with shell status
- Supports optional regex filtering to show only lines matching a pattern
- Use this tool when you need to monitor or check the output of a long-running shell
`;

  schema = z.object({
    bash_id: z
      .string()
      .describe('The ID of the background shell to retrieve output from'),
    filter: z
      .string()
      .optional()
      .describe(
        'Optional regular expression to filter the output lines. Only lines matching this regex will be included in the result. Any lines that do not match will no longer be available to read.',
      ),
  });

  constructor(fields?: BashToolParameters) {
    super(fields);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    const { bash_id, filter } = input;
    const bashSession = bashManager.getBackgroundBashSession(bash_id);

    if (!bashSession) {
      return `Bash session not found, bash_id: ${bash_id}`;
    }
    let stdouts = bashSession.stdout.map((item) => item.content);
    let stderrs = bashSession.stderr.map((item) => item.content);
    let stdout = stdouts.join('\n');
    let stderr = stderrs.join('\n');

    if (filter) {
      stdout = stdouts
        .filter((item) => item.match(new RegExp(filter)))
        .join('\n');
      stderr = stderrs
        .filter((item) => item.match(new RegExp(filter)))
        .join('\n');
    }

    if (stdout && stdout.length > MAX_OUTPUT_LENGTH) {
      stdout = truncateText(stdout, 1000);
    }
    let errorMessage = bashSession.errorMessage;
    if (errorMessage && errorMessage.length > MAX_OUTPUT_LENGTH) {
      errorMessage = truncateText(errorMessage, 1000);
    }

    const llmContent = [
      `Command: ${bashSession.command}`,
      `Directory: ${bashSession.directory || '(root)'}`,
      `Stdout: ${stdout || '(empty)'}`,
      `Stderr: ${stderr || '(empty)'}`,
      `Error: ${errorMessage ?? '(none)'}`,
      `Exit Code: ${bashSession.exitCode ?? '(none)'}`,
      `Signal: ${bashSession.processSignal ?? '(none)'}`,
      `Duration: ${Math.floor(
        (new Date().getTime() - bashSession.startTime.getTime()) / 1000,
      )} s`,
      `IsRunning: ${bashSession.isExited ? 'No' : 'Yes'}`,
      `Process Group PGID: ${bashSession.pid ?? '(none)'}`,
    ].join('\n');

    return llmContent;
  }
}

export class KillBashTool extends BaseTool {
  static readonly Name = 'kill_bash';

  toolKitName: string = 'bash_toolkit';

  name = 'kill_bash';

  description = `- Kills a running background bash shell by its ID
- Takes a bash_id parameter identifying the shell to kill
- Returns a success or failure status
- Use this tool when you need to terminate a long-running shell
`;

  schema = z.object({
    bash_id: z.string().describe('The ID of the background shell to kill'),
  });

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    const { bash_id } = input;
    const bashSession = await bashManager.remove(bash_id);
    if (bashSession) {
      let stdout = bashSession.stdout.map((item) => item.content).join('\n');
      let stderr = bashSession.stderr.map((item) => item.content).join('\n');
      const llmContent = [
        `Command: ${bashSession.command}`,
        `Directory: ${bashSession.directory || '(root)'}`,
        `Stdout: ${stdout || '(empty)'}`,
        `Stderr: ${stderr || '(empty)'}`,
        `Error: ${bashSession.errorMessage ?? '(none)'}`,
        `Exit Code: ${bashSession.exitCode ?? '(none)'}`,
        `Signal: ${bashSession.processSignal ?? '(none)'}`,
        `Duration: ${Math.floor(
          (new Date().getTime() - bashSession.startTime.getTime()) / 1000,
        )} s`,
        `IsRunning: ${bashSession.isExited ? 'No' : 'Yes'}`,
        `Process Group PGID: ${bashSession.pid ?? '(none)'}`,
      ].join('\n');

      return llmContent;
    }
    return `Bash session ${bash_id} not found`;
  }
}

export class BashToolkit extends BaseToolKit {
  name: string = 'bash_toolkit';

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

  constructor(params: BashToolParameters) {
    super(params);
  }

  getTools(): BaseTool[] {
    return [
      new BashTool(this.params),
      new BashOutputTool(),
      new KillBashTool(),
    ];
  }
}

export interface BashSession {
  shell: ChildProcessByStdio<null, Stream.Readable, Stream.Readable>;
  bashId: string;
  command: string;
  directory: string;
  stdout: {
    content: string;
    timestamp: Date;
  }[];
  stderr: {
    content: string;
    timestamp: Date;
  }[];
  startTime: Date;
  errorMessage?: string;
  isExited: boolean;
  exitCode?: number;
  pid: number;
  lastGetOutputTime?: Date;
  abortController?: AbortController;
  processSignal?: NodeJS.Signals;
}

export class BashManager {
  private bashMap: Map<string, BashSession> = new Map();

  async runInBackground(
    input: {
      command: string;
    },
    bashId?: string,
    cwd?: string,
    timeout?: number,
    abortSignal?: AbortSignal,
  ) {
    let abortController: AbortController;
    if (!abortSignal) {
      abortController = new AbortController();

      // 2. 从控制器获取 signal
      const signal = abortController.signal;
      abortSignal = signal;
    }
    const { shell, tempFilePath, command } = createShell(
      input.command,
      cwd,
      timeout,
    );
    if (!bashId) {
      bashId = crypto.randomBytes(4).toString('hex');
    }
    const bashSession: BashSession = {
      shell,
      bashId,
      command: input.command,
      directory: cwd,
      stdout: [],
      stderr: [],
      startTime: new Date(),
      errorMessage: undefined,
      isExited: false,
      exitCode: undefined,
      pid: shell.pid,
      lastGetOutputTime: new Date(),
      abortController,
    };
    this.bashMap.set(bashId, bashSession);

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
        bashSession.stdout.push({
          content: str,
          timestamp: new Date(),
        });
        appendOutput(str);
      }
    });

    let stderr = '';
    shell.stderr.on('data', (data: Buffer) => {
      if (!exited) {
        const str = stripAnsi(data.toString());
        stderr += str;
        bashSession.stderr.push({
          content: str,
          timestamp: new Date(),
        });
        appendOutput(str);
      }
    });

    let error: Error | null = null;
    shell.on('error', (err: Error) => {
      error = err;
      // remove wrapper from user's command in error message

      error.message = error.message.replace(command, input.command);
      bashSession.errorMessage = error.message;
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
      bashSession.exitCode = _code;
      bashSession.isExited = true;
      bashSession.processSignal = _signal;
      console.log('exit', `${bashSession.bashId}`);
    };
    shell.on('exit', exitHandler);

    const abortHandler = async () => {
      console.log('abort', `${bashSession.bashId}`);
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

    try {
      await new Promise((resolve) => shell.on('exit', resolve));
    } finally {
      abortSignal?.removeEventListener('abort', abortHandler);
    }
  }

  hasUpdate(bash_id: string) {
    const bashSession = this.bashMap.get(bash_id);
    if (!bashSession) {
      console.error(`bash session ${bash_id} not found`);
      return false;
    }

    const stdout = bashSession.stdout.filter(
      (item) => item.timestamp > bashSession.lastGetOutputTime,
    );
    const stderr = bashSession.stderr.filter(
      (item) => item.timestamp > bashSession.lastGetOutputTime,
    );

    if (
      bashSession.lastGetOutputTime < new Date() &&
      (stdout.length > 0 || stderr.length > 0 || bashSession.isExited)
    ) {
      return true;
    }
    return false;
  }

  get(bash_id: string): BashSession | null {
    const bashSession = this.bashMap.get(bash_id);
    if (!bashSession) {
      console.error(`bash session ${bash_id} not found`);
      return null;
    }
    return bashSession;
  }

  getBackgroundBashSession(bash_id: string) {
    const bashSession = this.bashMap.get(bash_id);
    if (!bashSession) {
      console.error(`bash session ${bash_id} not found`);
      return null;
    }
    const lastGetOutputTime = bashSession.lastGetOutputTime;
    if (lastGetOutputTime) {
      bashSession.stdout = bashSession.stdout.filter(
        (item) => item.timestamp > lastGetOutputTime,
      );
      bashSession.stderr = bashSession.stderr.filter(
        (item) => item.timestamp > lastGetOutputTime,
      );
    }
    if (bashSession.isExited) {
      this.remove(bash_id);
    }
    bashSession.lastGetOutputTime = new Date();
    return bashSession;
  }

  kill(bash_id: string) {
    const bashSession = this.bashMap.get(bash_id);
    if (!bashSession) {
      console.error(`bash session ${bash_id} not found`);
      return;
    }
    if (!bashSession.isExited) {
      try {
        bashSession.abortController?.abort();
      } catch (error) {
        console.error(`failed to kill shell process ${bash_id}: ${error}`);
      }
    }
  }

  async remove(bash_id: string) {
    let bashSession = this.bashMap.get(bash_id);
    if (!bashSession) {
      console.error(`bash session ${bash_id} not found`);
      return;
    }
    if (!bashSession.isExited) {
      this.kill(bash_id);
    }

    while (!bashSession.isExited) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    bashSession = this.bashMap.get(bash_id);
    if (bashSession.lastGetOutputTime) {
      bashSession.stdout = bashSession.stdout.filter(
        (item) => item.timestamp > bashSession.lastGetOutputTime,
      );
      bashSession.stderr = bashSession.stderr.filter(
        (item) => item.timestamp > bashSession.lastGetOutputTime,
      );
    }
    this.bashMap.delete(bash_id);
    return bashSession;
  }

  removeNotExsited(bash_ids: string[]) {
    const new_bash_ids: string[] = [];
    for (const bash_id of bash_ids) {
      if (this.bashMap.has(bash_id)) {
        new_bash_ids.push(bash_id);
      } else {
        this.bashMap.delete(bash_id);
      }
    }
    return new_bash_ids;
  }
}

const bashManager = new BashManager();
export default bashManager;
