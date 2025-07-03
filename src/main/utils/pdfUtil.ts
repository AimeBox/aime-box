import path from 'path';
import { getTmpPath, getAssetPath } from './path';

import { spawn } from 'child_process';
import { runCommand } from './exec';
import fs from 'fs';

/**
 * 将 PDF 每一页渲染为 PNG 图片
 * @param pdfPath PDF 文件路径
 * @param outputDir 输出目录
 */
export async function convertPdfToImages(pdfPath: string, outputDir: string) {
  // const info_data = await info(pdfPath);
  // console.log(info_data);
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
}
