import path from 'path';
import { getTmpPath, getAssetPath } from './path';

import { spawn } from 'child_process';
import { runCommand } from './exec';
import fs from 'fs';
import { dialog } from 'electron';
import { notificationManager } from '../app/NotificationManager';

/**
 * 将 PDF 每一页渲染为 PNG 图片
 * @param pdfPath PDF 文件路径
 * @param outputDir 输出目录
 */
export async function convertPdfToImages(
  pdfPath: string,
  outputDir: string,
): Promise<string[]> {
  // const info_data = await info(pdfPath);
  // console.log(info_data);
  if (process.platform === 'win32') {
    const popplerPath = path.join(
      getAssetPath(),
      'libs',
      'poppler',
      'pdftoppm.exe',
    );

    const tmpDirPrefix = path.join(outputDir, 'pdf-convert-');
    const tmpDir = fs.mkdtempSync(tmpDirPrefix);
    const outputPrefix = path.join(tmpDir, 'page');
    const res = await runCommand(
      `"${popplerPath}" "${pdfPath}" -jpeg "${outputPrefix}"`,
    );
    const files = await fs.promises.readdir(tmpDir);
    return files.map((file) => path.join(tmpDir, file));
  } else if (process.platform === 'darwin') {
    let hasPoppler = false;
    try {
      const res = await runCommand(`poppler -v`);
      hasPoppler = true;
    } catch {}
    if (!hasPoppler) {
      const res = await dialog.showMessageBox({
        title: 'poppler not found',
        message: 'poppler not found, please install it',
        buttons: ['OK', 'Cancel'],
      });
      if (res.response === 1) {
        throw new Error('poppler install cancelled');
      }
      await runCommand(`brew install poppler`, { timeout: 60 * 1000 });
      await runCommand(`poppler -v`);
    }

    return [];
    //brew install poppler
  } else {
    throw new Error('not supported');
  }
}
