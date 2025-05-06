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
import { BaseTool } from './BaseTool';

export interface RapidOcrToolParameters extends ToolParams {}

export class RapidOcrTool extends BaseTool {
  schema = z.object({
    filePath: z.string().describe('the path of the image file'),
  });

  name: string = 'ocr';

  description: string = 'an ocr tool that accurately extracts text from images';

  constructor(params?: RapidOcrToolParameters) {
    super(params);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    if (
      !fs.existsSync(path.join(getModelsPath(), 'ocr', 'RapidOCR-json_v0.2.0'))
    ) {
      return 'model not found';
    }
    try {
      if (isString(input.filePath) || fs.statSync(input.filePath).isFile()) {
        const json_res = (await new Promise((resolve, reject) => {
          const process = spawn('RapidOCR-json.exe', {
            cwd: path.join(getModelsPath(), 'ocr', 'RapidOCR-json_v0.2.0'),
          });
          let output = null;
          process.stdin.write(
            `{"image_path": "${input.filePath.replaceAll('\\', '/')}"}\n`,
          );
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
              resolve(output);
            }
          });
        })) as any;
        if (json_res.code == 100) {
          return json_res.data.map((x) => x.text).join('');
        } else if (json_res.code == 101) {
          return 'Error:' + json_res.data;
        } else {
          return json_res.data;
        }
      } else {
        return 'Please provide a valid file path';
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
