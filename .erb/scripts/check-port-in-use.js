import chalk from 'chalk';
import { spawn } from 'child_process';
import detectPort from 'detect-port';

const port = '1212';

detectPort(port, (_err, availablePort) => {
  if (port !== String(availablePort)) {
    if (process.platform === 'win32') {
      const netstat = spawn('netstat', ['-ano', '|', 'findstr', `":${port}"`]);
      netstat.stdout.on('data', (data) => {
        console.log(data);
      });
      netstat.stderr.on('data', (data) => {
        console.log(data);
      });
    } else {
      const lsof = spawn('lsof', ['-i', `:${port}`]);
      lsof.stdout.on('data', (data) => {
        console.log(data);
      });
      lsof.stderr.on('data', (data) => {
        console.log(data);
      });
    }

    throw new Error(
      chalk.whiteBright.bgRed.bold(
        `Port "${port}" on "localhost" is already in use. Please use another port. ex: PORT=4343 npm start`,
      ),
    );
  } else {
    process.exit(0);
  }
});
