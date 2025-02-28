import { Tool, ToolParams } from '@langchain/core/tools';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import { Transformers } from '../utils/transformers';
import { ToolField } from './ToolField';
import FormData from 'form-data';
import fetch, { Response } from 'node-fetch';

export interface VectorizerParameters extends ToolParams {
  apiKeyName: string;

  apiKey: string;

  mode: string;
}

export class Vectorizer extends Tool {
  static lc_name() {
    return 'vectorizer';
  }

  name: string;

  description: string;

  apiKeyName: string;

  apiKey: string;

  officialLink: string;

  @ToolField({
    field: 'mode',
    component: 'Select',
    componentProps: {
      options: [
        { value: 'test', label: '测试' },
        { value: 'preview', label: '预览' },
        { value: 'production', label: '生产' },
      ],
    },
  })
  mode: string;

  constructor(params?: VectorizerParameters) {
    super(params);
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'vectorizer',
    });
    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: '一个将 PNG 和 JPG 图像快速轻松地转换为 SVG 矢量图的工具',
    });
    Object.defineProperty(this, 'apiKey', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(this, 'apiKeyName', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(this, 'mode', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'test',
    });
    Object.defineProperty(this, 'officialLink', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'https://vectorizer.ai/account',
    });
    this.apiKey = params?.apiKey;
    this.apiKeyName = params?.apiKeyName;
    this.mode = params?.mode;
  }

  async _call(input: string, runManager, config): Promise<string> {
    // 构建Basic Auth header
    const auth = `Basic ${Buffer.from(`${this.apiKeyName}:${this.apiKey}`).toString('base64')}`;
    const form = new FormData();
    form.append('image', fs.createReadStream(input)); // 将文件添加到 FormData
    form.append('mode', this.mode);
    const res = await fetch('https://vectorizer.ai/api/v1/vectorize', {
      method: 'POST',
      headers: {
        Authorization: auth,
      },
      body: form,
    });
    if (res.ok) {
      const buffer: Buffer = await res.buffer();

      // 将 buffer 写到文件 result.svg
      // fs.writeFileSync('result.svg', buffer);
      const xml = buffer.toString();
      return xml;
    } else {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    return '';
  }
}
