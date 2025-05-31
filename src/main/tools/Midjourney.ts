import {
  Tool,
  ToolParams,
  StructuredTool,
  ToolSchemaBase,
} from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
} from 'child_process';
import { isArray, isString, isUrl } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path, { dirname } from 'path';
import { app } from 'electron';
import fs, { mkdirSync } from 'fs';
import { PlaywrightWebBaseLoader } from '@langchain/community/document_loaders/web/playwright';
import settingsManager from '../settings';
import { getDataPath, getTmpPath } from '../utils/path';
import { chromium } from 'playwright';
import fetch from 'node-fetch';
import axios from 'axios';
import sharp from 'sharp';
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';

export interface MidjourneyParameters extends ToolParams {
  apiKey: string;

  apiBase: string;

  mode: string;
}

export class Midjourney extends BaseTool {
  schema = z.object({
    prompt: z.string(),
  });

  name: string = 'midjourney';

  description: string = 'generate image';

  // officialLink: string;

  apiKey: string;

  apiBase: string;

  mode: string;

  configSchema: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'Input',
      label: 'API Key',
    },
    {
      field: 'apiBase',
      component: 'Input',
      label: 'API Base',
      defaultValue: 'https://api.openai-hk.com',
    },
    {
      field: 'mode',
      component: 'Select',
      label: 'Mode',
      componentProps: {
        options: [
          { label: 'Relax', value: 'relax' },
          { label: 'Fast', value: 'fast' },
        ],
      },
      defaultValue: 'relax',
    },
  ];

  constructor(params?: MidjourneyParameters) {
    super(params);
    this.apiKey = params?.apiKey;
    this.apiBase = params?.apiBase;
    this.mode = params?.mode;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        base64Array: [],
        instanceId: '',
        modes: ['FAST'],
        notifyHook: null,
        prompt: input.prompt,
        remix: true,
        state: '',
      }),
    };

    const url = `${this.apiBase.replace(/\/+$/, '')}/${this.mode}/mj/submit/imagine`;
    const res = await fetch(url, options);
    const resJson = await res.json();

    const result_id = resJson.result;
    // eslint-disable-next-line prefer-destructuring, dot-notation
    const properties = resJson['properties'];

    if (properties.bannedWord) {
      throw new Error(`bannedWord: ${properties.bannedWord}`);
    }
    const rtmppath = getTmpPath();
    const dir = path.join(rtmppath, 'mj');

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    let imageUrl: string = null;
    let filename = '';
    let ext = '';
    let prompt = '';
    while (true) {
      const task_url = `${this.apiBase.replace(/\/+$/, '')}/${this.mode}/mj/task/${result_id}/fetch`;
      const task_res = await fetch(task_url, {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      if (task_res.status != 200) {
        throw new Error(`Error: ${await task_res.text()}`);
      }

      const task_resJson: {
        code: number;
        action: string;
        botType: string;
        customId: string;
        description: string;
        failReason: string;
        finishTime: number;
        id: string;
        imageUrl: string;
        maskBase64: string;
        progress: string;
        prompt: string;
        promptEn: string;
        startTime: number;
        state: string;
        status: string;
        submitTime: number;
        properties: { finalPrompt: string; finalZhPrompt: string };
      } = await task_res.json();
      console.log(`${task_resJson.progress} ${task_resJson.description}`);
      if (task_resJson.status == 'FAILURE') {
        const { failReason } = task_resJson;
        throw new Error(`Error: ${failReason}`);
      }
      if (task_resJson.status == 'SUCCESS') {
        console.log(task_resJson);
        imageUrl = task_resJson.imageUrl;
        filename = new URL(task_resJson.imageUrl).pathname.split('/')[
          new URL(task_resJson.imageUrl).pathname.split('/').length - 1
        ];
        ext = path.extname(filename);
        filename = path.basename(filename, path.extname(filename));
        prompt = task_resJson.properties.finalPrompt;
        break;
      }
      if (task_resJson.code == 24) {
        throw new Error(`Error: ${task_resJson.description}`);
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 5000);
      });
    }
    const seed: string | null = await this.getSeed(result_id);
    try {
      const fileImgPath = path.join(dir, `${filename}--seed-${seed}${ext}`);
      // const fileStream = fs.createWriteStream(fileImgPath);
      // const img_res = await request(`https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}`);
      await this.downloadImage(
        `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}`,
        fileImgPath,
      );
      await this.splitImage(fileImgPath);
    } catch (err) {}

    return `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}`;
  }

  async getSeed(id: string): Promise<string> {
    const url = `${this.apiBase.replace(/\/+$/, '')}/${this.mode}/mj/task/${id}/image-seed`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
        },
      });
      if (res.ok) {
        const jres: {
          code: number;
          description: string;
          result: string;
        } = await res.json();
        if (jres.code == 1) return jres.result;
        return null;
      } else {
        return null;
      }
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  async splitImage(imagePath: string) {
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(imagePath);
      const fileData = []; //存储文件流
      stream.on('data', (data) => {
        fileData.push(data);
      });
      stream.on('end', async () => {
        const finalData = Buffer.concat(fileData);
        let image = sharp(finalData);
        try {
          const metadata = await image.metadata();

          const imgWidth = metadata.width!;
          const imgHeight = metadata.height!;

          // 定义输出文件名规则和分割位置
          const baseName = path.basename(imagePath, path.extname(imagePath));
          const dirName = path.dirname(imagePath);
          const extensions = ['.jpg', '.png', '.jpeg', '.webp'];

          if (!extensions.includes(path.extname(imagePath).toLowerCase())) {
            throw new Error('只支持图片文件类型：jpg, png, jpeg, webp');
          }

          const halfWidth = Math.ceil(imgWidth / 2);
          const halfHeight = Math.ceil(imgHeight / 2);
          await image
            .extract({
              left: 0,
              top: 0,
              width: halfWidth,
              height: halfHeight,
            })
            .toFile(
              path.join(dirName, `${baseName}_1${path.extname(imagePath)}`),
            );
          image.destroy();
          image = sharp(finalData);
          await image
            .extract({
              left: halfWidth,
              top: 0,
              width: imgWidth - halfWidth,
              height: halfHeight,
            })
            .toFile(
              path.join(dirName, `${baseName}_2${path.extname(imagePath)}`),
            );
          image.destroy();
          image = sharp(finalData);
          await image
            .extract({
              left: 0,
              top: halfHeight,
              width: halfWidth,
              height: imgHeight - halfHeight,
            })
            .toFile(
              path.join(dirName, `${baseName}_3${path.extname(imagePath)}`),
            );
          image.destroy();
          image = sharp(finalData);
          await image
            .extract({
              left: halfWidth,
              top: halfHeight,
              width: imgWidth - halfWidth,
              height: imgHeight - halfHeight,
            })
            .toFile(
              path.join(dirName, `${baseName}_4${path.extname(imagePath)}`),
            );
          image.destroy();

          resolve(null);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  async downloadImage(url: string, filePath: string): Promise<void> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      // 确保响应体是一个可读流
      const fileStream = fs.createWriteStream(filePath);
      response.body.pipe(fileStream);

      return new Promise((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      });
    } catch (error) {
      console.error(`下载图片失败：${error}`);
      throw error;
    }
  }
}
