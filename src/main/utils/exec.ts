import { exec, execFile, execFileSync, spawn } from 'node:child_process';
import { platform } from 'node:process';
import iconv from 'iconv-lite';
import fixPath from 'fix-path';
import os from 'os';
import settingsManager from '../settings';

export const runCommandSync = (command: string) => {
  if (platform == 'win32') {
    return execFileSync('powershell.exe', [command]);
  } else if (platform == 'darwin') {
    return execFileSync('bash', [command]);
  } else if (platform == 'linux') {
    return execFileSync('bash', [command]);
  }
  throw new Error('Unsupported platform');
};
export const runCommand = async (
  command: string,
  options: {
    file?: string;
    cwd?: string;
    env?: string;
    timeout?: number;
    stdout?: (data: any) => void;
    stderr?: (data: any) => void;
  } = {},
): Promise<string> => {
  const { file, cwd, timeout, stdout, stderr } = options;
  let _file = file;
  if (!_file) {
    if (platform == 'win32') {
      _file = 'cmd.exe';
    } else if (platform == 'darwin') {
      _file = 'bash';
    } else if (platform == 'linux') {
      _file = 'bash';
    }
  }

  return new Promise((resolve, reject) => {
    debugger;
    const commands = [];
    if (_file == 'cmd.exe') {
      commands.push(_file);
      commands.push('/c');
      commands.push(`"${command}"`);
    } else if (_file == 'pwsh.exe') {
      commands.push(_file);
      commands.push('-Command');
      commands.push(`"${command}"`);
    } else {
      commands.push(command);
    }
    fixPath();
    const env = {
      ...process.env,
      PATH: process.env.PATH,
      HOME: os.homedir(),
      LANG: 'zh_CN.UTF-8',
      LC_ALL: 'zh_CN.UTF-8',
    };
    if (settingsManager.getProxy()) {
      env['HTTP_PROXY'] = settingsManager.getProxy();
      env['HTTPS_PROXY'] = settingsManager.getProxy();
    }

    const child = exec(
      commands.join(' '),
      {
        encoding: 'buffer',
        windowsHide: false,
        cwd: cwd,
        env: env,
        timeout: timeout,
      },
      (error, stdout, stderr) => {
        const res_out = iconv.decode(
          stdout,
          platform == 'win32' ? 'cp936' : 'utf8',
        );
        const res_err = iconv.decode(
          stderr,
          platform == 'win32' ? 'cp936' : 'utf8',
        );
        if (error) {
          if (res_err) {
            reject(new Error(`Error:\n${res_err}`));
            return;
          }
          if (res_out) {
            reject(new Error(`${res_out}`));
            return;
          }

          reject(new Error(`${error.message}`));
          return;
        }
        const out = iconv.decode(
          stdout,
          platform == 'win32' ? 'cp936' : 'utf8',
        );
        resolve(out || res_err);
      },
    );
    child.stdout?.on('data', (data: any) => {
      stdout?.(data);
    });

    // 动态获取 stderr
    child.stderr?.on('data', (data: any) => {
      stderr?.(data);
    });

    // 结束时处理退出码
    child.on('close', (code) => {
      console.log(`子进程退出，退出码 ${code}`);
    });
  });
};
