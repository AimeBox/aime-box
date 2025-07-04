import { exec, execFile, execFileSync, spawn } from 'node:child_process';
import { platform } from 'node:process';
import iconv from 'iconv-lite';
import fixPath from 'fix-path';

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
  file?: string,
  cwd?: string,
): Promise<string> => {
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

    const child2 = exec(
      commands.join(' '),
      {
        encoding: 'buffer',
        windowsHide: false,
        cwd: cwd,
        env: {
          PATH: process.env.PATH,
        },
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
        resolve(out);
      },
    );
    return;
    const child = execFile(
      _file,
      commands,
      {
        encoding: 'buffer',
        // stdio: ['pipe', 'pipe', 'pipe'],
        // shell: true,
        // windowsVerbatimArguments: true,
      },
      (error, stdout, stderr) => {
        const res_out = iconv.decode(stdout, 'cp936');
        const res_err = iconv.decode(stderr, 'cp936');
        if (error) {
          if (res_err) {
            reject(new Error(`Error:\n${res_err}`));
            return;
          }
          if (res_out) {
            reject(new Error(`${res_out}`));
            return;
          }
          return;
        }
        const out = iconv.decode(stdout, 'cp936');
        resolve(out);
      },
    );
    // let stdoutData = Buffer.alloc(0);
    // let stderrData = Buffer.alloc(0);
    // child.stdout.on('data', (chunk) => {
    //   stdoutData = Buffer.concat([stdoutData, chunk]);
    //   const output = iconv.decode(stdoutData, 'cp936');
    //   console.log(output);
    // });
    // // if (command) {
    // //   child.stdin.write(command);
    // //   child.stdin.end();
    // // }

    // // 收集错误输出
    // child.stderr.on('data', (chunk) => {
    //   stderrData = Buffer.concat([stderrData, chunk]);
    // });

    // child.on('close', (code) => {
    //   if (code === 0) {
    //     const output = iconv.decode(stdoutData, 'cp936');
    //     resolve(output);
    //   } else {
    //     const errorOutput = iconv.decode(stderrData, 'cp936');
    //     reject(new Error(`进程退出，退出码 ${code}\n${errorOutput}`));
    //   }
    // });
    // child.on('error', (error) => {
    //   reject(error);
    // });
  });
};
