import fs from 'fs';
import webpackPaths from '../configs/webpack.paths';

const foldersToRemove = [
  webpackPaths.distPath,
  webpackPaths.buildPath,
  webpackPaths.dllPath,
  webpackPaths.srcNodeModulesPath,
];

console.log('Removing folders:', foldersToRemove);

for (const folder of foldersToRemove) {
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}
