import { Tool, ToolParams } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
  spawn,
} from 'child_process';
import { isArray, isString } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { getModelsPath } from '../utils/path';

// const getModelsPath = (...paths: string[]): string => {
//   return path.join(
//     app.isPackaged
//       ? path.join(process.resourcesPath, 'models')
//       : path.join(__dirname, '../../../models'),
//     ...paths,
//   );
// };
export interface RapidOcrToolParameters extends ToolParams {}

export class RapidOcrTool extends Tool {
  static lc_name() {
    return 'RapidOcrTool';
  }

  name: string;

  description: string;

  constructor(params?: RapidOcrToolParameters) {
    super(params);
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'ocr',
    });
    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'an ocr tool that accurately extracts text from images',
    });

    // Object.defineProperty(this, 'schema', {
    //   enumerable: true,
    //   configurable: true,
    //   writable: true,
    //   value: z.object({
    //     input: z.string().brand<'FileInfo'>(),
    //   }),
    // });
  }

  async _call(
    filePath: string | string[],
    runManager,
    config,
  ): Promise<string> {
    try {
      if (isString(filePath)) {
        const json_res = (await new Promise((resolve, reject) => {
          const process = spawn('RapidOCR-json.exe', {
            cwd: path.join(getModelsPath(), 'RapidOCR-json_v0.2.0'),
          });
          let output = null;
          // 向进程的标准输入写入 "run"
          process.stdin.write(
            `{"image_path": "${filePath.replaceAll('\\', '/')}"}\n`,
          ); // \n 模拟按下回车键

          // 处理子进程的输出
          process.stdout.on('data', (data) => {
            const text = data.toString();

            if (text.startsWith('{"code":')) {
              const j = JSON.parse(text);
              output = j;
              process.kill();
            }
            //process.kill();
          });

          process.stderr.on('data', (data) => {
            process.kill();
          });

          process.on('close', (code) => {
            if (output != null && output.code == 100) {
              resolve(output);
            } else {
              reject(output);
            }
          });
        })) as any;
        if (json_res.code == 100) {
          return json_res.data.map((x) => x.text).join('');
        } else {
          return json_res.data;
        }

        // const out = execFileSync(
        //   path.join(
        //     getModelsPath(),
        //     'RapidOCR-json_v0.2.0',
        //     'RapidOCR-json.exe',
        //   ),
        //   [`--image="${path.resolve(filePath)}"`],
        //   {
        //     cwd: path.join(getModelsPath(), 'RapidOCR-json_v0.2.0'),
        //     //encoding: 'utf8',
        //   },
        // );
        // let res = out.toString();
        // res = res.substring(res.indexOf('OCR init completed.\r\n') + 21);
        // const json_res = JSON.parse(res) as any;
        // if (json_res.code == 100) {
        //   return json_res.data.map((x) => x.text).join('');
        // } else {
        //   return json_res.data;
        // }
      }
    } catch (err) {
      const out = iconv.decode(
        new Buffer(err.stderr.length > 0 ? err.stderr : err.stdout),
        'cp936',
      );

      return out.trim();
    }
    return null;
  }
}
