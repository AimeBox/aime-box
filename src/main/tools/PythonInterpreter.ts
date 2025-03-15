import { StructuredTool, Tool, ToolParams } from '@langchain/core/tools';
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
import { runCommand, runCommandSync } from '../utils/exec';
import { getTmpPath } from '../utils/path';
import { platform } from 'process';
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';

export interface PythonInterpreterParameters extends ToolParams {
  pythonPath?: string;
  keepVenv?: boolean;
}

export class PythonInterpreterTool extends BaseTool {
  static lc_name() {
    return 'python_interpreter';
  }

  configSchema: FormSchema[] = [
    {
      label: 'Python Path',
      field: 'pythonPath',
      component: 'Input',
    },
    {
      label: 'Keep Venv',
      field: 'keepVenv',
      component: 'Switch',
      defaultValue: false,
    },
  ];

  schema = z.object({
    script: z.string().describe('python script'),
    sensitive: z.optional(z.boolean().describe('if the script is sensitive')),
    dependencies: z.optional(
      z.array(z.string()).describe('python pip dependencies to install'),
    ),
  });

  name: string = 'python_interpreter';

  description: string = `Evaluates python code in a sandbox environment. The environment resets on every execution. You must send the whole script every time and print your outputs.`;

  pythonPath: string;

  keepVenv: boolean = false;

  constructor(params?: PythonInterpreterParameters) {
    super(params);

    this.pythonPath = params?.pythonPath;
    this.keepVenv = params?.keepVenv ?? false;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    let tempDir;
    try {
      if (!this.pythonPath) {
        try {
          this.pythonPath = (
            await runCommand(`python -c 'import sys;print(sys.executable)'`)
          )
            .toString()
            .trim();
        } catch (e) {
          console.error(e);
        }
      }
      if (!this.pythonPath) {
        return 'not found python';
      }
      console.log(`Python Path: ${this.pythonPath}`);

      if (config?.configurable?.chatRootPath) {
        tempDir = path.join(config?.configurable?.chatRootPath, 'sandbox');
        fs.mkdirSync(tempDir, { recursive: true });
      } else {
        fs.mkdirSync(path.join(getTmpPath(), 'sandbox'), { recursive: true });
        tempDir = fs.mkdtempSync(
          path.join(getTmpPath(), 'sandbox', `sandbox-`),
        );
      }
      if (!fs.existsSync(path.join(tempDir, 'venv'))) {
        await this.createVenv(path.join(tempDir, 'venv'));
      }
      if (platform == 'win32') {
        this.pythonPath = path.join(tempDir, 'venv', 'Scripts', 'python.exe');
      } else if (platform == 'darwin') {
        this.pythonPath = path.join(tempDir, 'venv', 'bin', 'python');
      } else if (platform == 'linux') {
        this.pythonPath = path.join(tempDir, 'venv', 'bin', 'python');
      }
      console.log(`venv is allready created: ${path.join(tempDir, 'venv')}`);
      if (
        input.dependencies &&
        input.dependencies.filter((x) => x.trim()).length > 0
      ) {
        let isSuccess = false;
        console.log(`install dependencies: ${input.dependencies}`);
        for (let i = 0; i < 5; i++) {
          try {
            const res = await runCommand(
              `${this.pythonPath} -m pip install ${input.dependencies.join(' ')}`,
            );
            console.log(res);
            isSuccess = true;
            break;
          } catch {
            await new Promise((resolve) => {
              setTimeout(resolve, 2000);
            });
          }
        }
        if (!isSuccess) {
          return 'install dependencies failed';
        }
      }
      let isSuccess = false;
      console.log('check python virtual environment');
      for (let i = 0; i < 5; i++) {
        try {
          const res = await runCommand(`${this.pythonPath} -V`);
          console.log(res);
          isSuccess = true;
          break;
        } catch {
          await new Promise((resolve) => {
            setTimeout(resolve, 2000);
          });
        }
      }
      if (!isSuccess) {
        return 'check python virtual environment failed';
      }

      const options = {
        mode: 'text',
        pythonPath: this.pythonPath,
        pythonOptions: ['-u'], // get print results in real-time
        encoding: 'binary',
        parser: (data) => {
          console.log(data);
          return data;
        },
        //scriptPath: 'path/to/my/scripts',
        //args: ['value1', 'value2', 'value3'],
      } as Options;

      let isFile = false;
      let pythonScriptFilePath;
      try {
        const stat = fs.statSync(input.script);
        pythonScriptFilePath = input.script;
        isFile = stat.isFile();
      } catch {
        fs.writeFileSync(path.join(tempDir, 'main.py'), input.script, 'utf8');
        pythonScriptFilePath = path.join(tempDir, 'main.py');
        isFile = true;
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
      if (isFile) {
        const res = await runCommand(
          `${this.pythonPath} ${pythonScriptFilePath}`,
        );
        if (res.toString().trim() == '') {
          return 'you should use print() in script!';
        }
        //const res = await PythonShell.run(pythonScriptFilePath, options);
        return res.toString().trim();
      } else {
        const res = await PythonShell.runString(input.script, options);
        return res.join('\r\n');
      }

      //const res = await PythonShell.run('my_script.py', options);
    } catch (err) {
      if (err.message) {
        return err.message;
      }
      const out = iconv.decode(
        new Buffer(err.stderr.length > 0 ? err.stderr : err.stdout),
        'cp936',
      );

      return out.trim();
    } finally {
      if (!this.keepVenv && tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
    }
    return null;
  }

  async createVenv(path: string) {
    const res = await runCommand(`python -m venv ${path}`).toString().trim();
  }
}
