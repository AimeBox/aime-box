/* eslint-disable import/prefer-default-export */
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  Tool,
  StructuredTool,
  ToolParams,
  ToolRunnableConfig,
} from '@langchain/core/tools';
import gifFrames from 'gif-frames';
import { Transformers } from '../utils/transformers';
import { z } from 'zod';
import { isUrl } from '../utils/is';
import fs from 'fs';
import path from 'path';
import { getTmpPath } from '../utils/path';
import { v4 as uuidv4 } from 'uuid';
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';
import { t } from 'i18next';
import { downloadFile, saveFile } from '../utils/common';
import crypto from 'crypto';
import sharp from 'sharp';
import GIFEncoder from 'gif-encoder-2';

export interface RemoveBackgroundParameters extends ToolParams {
  modelName: string;
}

export class RemoveBackground extends BaseTool {
  schema = z.object({
    pathOrUrl: z.string().describe('local file or folder path, or Url '),
    // outputFormat: z.optional(z.enum(['base64', 'file'])).default('file'),
    savePath: z.string().optional().describe('save png file path'),
  });

  configSchema: FormSchema[] = [
    {
      label: t('common.model'),
      field: 'modelName',
      component: 'Select',
      defaultValue: 'rmbg-1.4',
      componentProps: {
        options: [
          { label: 'rmbg-2.0', value: 'rmbg-2.0' },
          { label: 'rmbg-1.4', value: 'rmbg-1.4' },
        ],
      },
    },
  ];

  name = 'remove_background';

  description = 'Remove Image Background, support (*.jpg, *.jpeg)';

  modelName: string;

  output = 'c:\\windows\\...';

  constructor(params?: RemoveBackgroundParameters) {
    super(params);
    this.modelName = params?.modelName;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<string> {
    const workspace = config?.configurable?.workspace;
    let { pathOrUrl } = input;
    if (isUrl(pathOrUrl)) {
      pathOrUrl = await downloadFile(pathOrUrl);
    }
    if (workspace && !isUrl(pathOrUrl)) {
      pathOrUrl = path.isAbsolute(pathOrUrl)
        ? pathOrUrl
        : path.join(workspace, pathOrUrl);
    }

    const model = new Transformers({
      task: 'image-segmentation',
      modelName: this.modelName ?? 'rmbg-1.4',
    });
    if (path.extname(pathOrUrl).toLowerCase() == '.gif') {
      const frames = await gifFrames({
        url: pathOrUrl,
        frames: 'all',
        outputType: 'jpg',
        quality: 100,
      });

      const dirName = crypto.randomBytes(4).toString('hex');
      fs.mkdirSync(path.join(getTmpPath(), dirName), { recursive: true });
      const pngFiles = [];
      for (const [index, frame] of frames.entries()) {
        const buffer = frame.getImage().toBuffer();
        const jpgPath = await saveFile(
          buffer,
          path.join(getTmpPath(), dirName, `frame_${index}.jpg`),
        );
        const rm_buffer = await model.rmbg(jpgPath);
        const pngPath = await saveFile(
          rm_buffer,
          path.join(getTmpPath(), dirName, `frame_${index}.png`),
        );
        pngFiles.push(pngPath);
      }
      const { width, height } = await sharp(pngFiles[0]).metadata();
      const encoder = new GIFEncoder(width!, height!, 'octree', true);
      encoder.setDelay(500); // 每帧延迟 ms
      encoder.setRepeat(0); // 0 无限循环
      encoder.setTransparent(null); // 不透明背景
      const writeStream = fs.createWriteStream(input.savePath);
      encoder.createReadStream().pipe(writeStream);

      encoder.start();

      for (const imgPath of pngFiles) {
        const { data } = await sharp(imgPath)
          .resize(width!, height!)
          .raw()
          .toBuffer({ resolveWithObject: true });

        encoder.addFrame(data);
      }

      encoder.finish();

      return `<file>${pngFiles.join(',')}</file>`;
      // fs.rmSync(path.join(getTmpPath(), dirName), { recursive: true });
    }

    const buffer = await model.rmbg(pathOrUrl);

    let savePath;
    if (input.savePath) {
      savePath = await saveFile(buffer, input.savePath, config);
    } else {
      savePath = await saveFile(buffer, `${uuidv4()}.png`, config);
    }

    return `<file>${savePath}</file>`;
  }
}
