import { StructuredTool, Tool, ToolParams } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
  execFile,
  fork,
  spawn,
} from 'child_process';
import { isArray, isString } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path from 'path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
// import Potrace from 'potrace';
import { NodeVM, VM } from 'vm2';
import { getTmpPath } from '../utils/path';
import { v4 as uuidv4 } from 'uuid';
import util from 'util';
import { Worker } from 'worker_threads';

const execPromise = util.promisify(exec);

export interface NodejsVMParameters extends ToolParams {
  sensitive: boolean;
}

export class NodejsVM extends StructuredTool {
  static lc_name() {
    return 'NodejsVM';
  }

  schema = z.object({
    script: z.string().describe('nodejs script'),
    dependencies: z.optional(
      z.array(z.string()).describe('nodejs dependencies to install'),
    ),
  });

  name: string;

  description: string;

  sensitive: boolean;

  constructor(params?: NodejsVMParameters) {
    super(params);
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'nodejs_vm',
    });
    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: '沙盒环境执行nodejs脚本,语言类型ts',
    });
    Object.defineProperty(this, 'sensitive', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: true,
    });

    this.sensitive = params?.sensitive;
  }

  installDependency(sandboxPath, dependency) {
    try {
      console.log(`Installing ${dependency} in sandbox environment...`);
      execSync(`npm install ${dependency}`, {
        cwd: sandboxPath,
        stdio: 'inherit',
      });
    } catch (error) {
      console.error(`Failed to install ${dependency}:`, error);
    }
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    let tempDir;
    try {
      if (!isString(input.script)) {
        return 'input value is not String';
      }

      const allWindows = BrowserWindow.getAllWindows();
      const res = await dialog.showMessageBoxSync(allWindows[0], {
        type: 'question',
        title: '是否允许运行代码',
        message: `您是否同意执行以下命令\n\n${input.script}`,
        buttons: ['运行', '取消'],
      });
      if (res == 0) {
        console.log(input.script);
        const uuid = uuidv4();
        fs.mkdirSync(path.join(getTmpPath(), 'sandbox'), { recursive: true });
        tempDir = fs.mkdtempSync(
          path.join(getTmpPath(), 'sandbox', `sandbox-`),
        );
        const nodeModulesPath = path.join(tempDir, 'node_modules');
        console.log(`Creating sandbox environment at: ${tempDir}`);

        // 初始化 package.json
        fs.writeFileSync(
          path.join(tempDir, 'package.json'),
          JSON.stringify({}),
          'utf8',
        );
        if (input.dependencies && input.dependencies.length > 0) {
          console.log('Installing dependencies...');
          const installCmd = `npm install ${input.dependencies.join(' ')} --prefix "${tempDir}"`;
          const out = await this.runWin32(installCmd);
          console.log(out);
          // const { stdout, stderr } = await execPromise(installCmd);
        }
        fs.writeFileSync(path.join(tempDir, 'index.js'), input.script, 'utf8');

        const child = fork(path.join(tempDir, 'index.js'));

        child.on('message', (msg) => {
          if (msg) {
            console.error('查询出错：', msg);
          } else {
            console.log('查询结果：', msg);
          }
        });

        // const result = await this.runWin32(
        //   `node "${path.join(tempDir, 'index.js')}"`,
        // );
        // const vm = new NodeVM({
        //   console: 'inherit',
        //   sandbox: {},
        //   require: {
        //     external: true, // 允许 require 外部模块
        //     builtin: ['*'],
        //     root: tempDir,
        //     resolve: (moduleName) => {
        //       return require.resolve(moduleName, { paths: [nodeModulesPath] });
        //     },
        //   },
        // });

        const wrappedScript = `
            (async () => {
                ${input.script}
            })()
        `;
        // const result = await vm.run(
        //   wrappedScript,
        //   path.join(tempDir, 'index.js'),
        // );

        // 创建一个新的vm.Context对象作为执行的沙箱
        // const sandbox = {};

        // // 在沙箱中执行脚本
        // script.runInNewContext(sandbox);

        //console.log(result); // 输出: set in sandbox

        // fs.rmSync(tempDir, { recursive: true, force: true });
        return '123';
      } else {
        return null;
      }
    } catch (err) {
      console.error(err);
      // if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
      throw err;
    }
  }

  runWin32(commands: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('cmd.exe', ['/c', commands], {
        detached: true, // 脱离父进程
        stdio: 'ignore', // 忽略子进程的输入输出（如果需要日志可以配置为 'inherit' 或自定义流）
      });

      //child.unref();
      child.on('close', (code) => {
        console.log(`子进程退出，退出码 ${code}`);
        resolve('ok');
      });
      child.on('error', (code) => {
        console.log(`子进程退出，退出码 ${code}`);
        reject('ok');
      });

      // execFile(
      //   'powershell.exe',
      //   [commands],
      //   { encoding: 'buffer' },
      //   (error, stdout, stderr) => {
      //     const res_out = iconv.decode(stdout, 'cp936');
      //     const res_err = iconv.decode(stderr, 'cp936');
      //     if (error) {
      //       if (res_err) {
      //         reject(new Error(`Error:\n${res_err}`));
      //         return;
      //       }
      //       if (res_out) {
      //         reject(new Error(`${res_out}`));
      //         return;
      //       }
      //       return;
      //     }

      //     const out = iconv.decode(stdout, 'cp936');
      //     resolve(out);
      //   },
      // );
    });
  }
}
