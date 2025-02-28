import { execFile, execFileSync } from 'child_process';
import { platform } from 'process';
import iconv from 'iconv-lite';

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
export const runCommand = async (command: string) => {
  let file;
  if (platform == 'win32') {
    file = 'powershell.exe';
  } else if (platform == 'darwin') {
    file = 'bash';
  } else if (platform == 'linux') {
    file = 'bash';
  }

  return new Promise((resolve, reject) => {
    execFile(
      file,
      [command],
      { encoding: 'buffer' },
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
  });
};
