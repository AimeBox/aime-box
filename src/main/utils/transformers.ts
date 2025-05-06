import { app } from 'electron';
import path from 'path';
import { getModelsPath } from './path';
import { isUrl } from './is';
import fs from 'fs';
import sharp from 'sharp';
import { PNG } from 'pngjs';
import {
  AutoProcessor,
  AutoTokenizer,
  AutoModelForSequenceClassification,
  RawImage,
  AutoModel,
  env,
  pipeline,
  ChineseCLIPModel,
  cos_sim,
} from '@huggingface/transformers';
import { borderColor } from 'tailwindcss/defaultTheme';
import settingsManager from '../settings';

export interface TransformersParams {
  task: string;
  modelName: string;
}
// eslint-disable-next-line import/prefer-default-export
export class Transformers {
  // private TransformersApi = null;

  private _pipeline = null;

  private _model = null;

  private _tokenizer = null;

  private _processor = null;

  private _rawImage = null;

  task: string;

  modelName: string;
  // batchSize: number = 512;

  // stripNewLines: boolean = true;

  // timeout?: number;

  // private pipelinePromise = null;

  constructor(fields?: Partial<TransformersParams>) {
    Object.defineProperty(this, 'task', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(this, 'modelName', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined,
    });

    this.modelName = fields?.modelName ?? this.modelName;
    this.task = fields?.task ?? this.task;
  }

  async rmbg(fileOrUrl: string) {
    env.localModelPath = path.join(getModelsPath(), 'other');
    env.allowRemoteModels = false;

    this._model = await AutoModel.from_pretrained(this.modelName, {
      dtype: this.modelName == 'rmbg-2.0' ? 'q4f16' : 'fp16',
      local_files_only: true,
    });
    this._processor = await AutoProcessor.from_pretrained(this.modelName, {});

    this._rawImage = RawImage;
    let image = null;
    if (isUrl(fileOrUrl)) image = await RawImage.fromURL(fileOrUrl);
    else if (fs.statSync(fileOrUrl).isFile()) {
      const data = fs.readFileSync(fileOrUrl);
      const blob = new Blob([data]);
      image = await RawImage.fromBlob(blob);
    }

    const ar = image.width / image.height;
    const { pixel_values } = await this._processor(image);

    let output;
    if (this.modelName == 'rmbg-1.4') {
      output = (await this._model({ input: pixel_values })).output;
    } else if (this.modelName == 'rmbg-2.0') {
      output = (await this._model({ pixel_values })).alphas;
    }

    const mask = await RawImage.fromTensor(
      output[0].mul(255).to('uint8'),
    ).resize(image.width, image.height);
    const png = new PNG({ width: image.width, height: image.height });

    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const maskIndex = y * image.width + x;
        const imageIndex = (y * image.width + x) * 3;
        const pngIndex = (y * image.width + x) * 4;
        png.data[pngIndex] = image.data[imageIndex];
        png.data[pngIndex + 1] = image.data[imageIndex + 1];
        png.data[pngIndex + 2] = image.data[imageIndex + 2];
        png.data[pngIndex + 3] = mask.data[maskIndex];
      }
    }
    const encoder = new PNG();
    encoder.data = png.data;
    encoder.width = image.width;
    encoder.height = image.height;
    const buffer = PNG.sync.write(encoder);

    return buffer;
  }

  async pipeline(): Promise<any> {
    if (this._pipeline == null) {
      // const { pipeline, env } = await this.TransformersApi;
      env.localModelPath = getModelsPath();
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      env.remoteHost = 'https://huggingface.co/';
      this._pipeline = pipeline;
    }

    return this._pipeline(this.task, this.modelName, {
      device: 'webgpu',
    });
  }

  async reranker(
    query: string,
    documents: string[],
    { top_k = undefined, return_documents = false } = {},
  ): Promise<{ document: string; index: number; score: number }[]> {
    if (this._tokenizer == null) {
      env.localModelPath = path.join(getModelsPath(), 'reranker');
      env.allowRemoteModels = false;
      const model = await AutoModelForSequenceClassification.from_pretrained(
        this.modelName,
        { dtype: 'q8' },
      );
      const tokenizer = await AutoTokenizer.from_pretrained(this.modelName);
      this._tokenizer = tokenizer;
      this._model = model;
    }
    const inputs = this._tokenizer(new Array(documents.length).fill(query), {
      text_pair: documents,
      padding: true,
      truncation: true,
    });
    const { logits } = await this._model(inputs);
    return logits
      .sigmoid()
      .tolist()
      .map(([score], i) => ({
        index: i,
        score,
        document: return_documents ? documents[i] : undefined,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, top_k);
  }

  async clip(input: string): Promise<any> {
    if (this._processor == null) {
      env.localModelPath = getModelsPath();
      env.allowRemoteModels = false;
      this._processor = await AutoProcessor.from_pretrained(this.modelName, {});
      this._model = await ChineseCLIPModel.from_pretrained(this.modelName);
      this._rawImage = RawImage;
    }
    const img = await this._rawImage.read(input);

    const inputs = await this._processor(img);

    const re = await this._model(inputs);
  }

  async doclayout(fileOrUrl: string): Promise<
    {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      score: number;
      label: string;
      index: number;
    }[]
  > {
    env.localModelPath = path.join(getModelsPath(), 'other');
    env.allowRemoteModels = false;
    const model = await AutoModel.from_pretrained(this.modelName);
    const processor = await AutoProcessor.from_pretrained(this.modelName, {});
    let image;
    if (isUrl(fileOrUrl)) image = await RawImage.fromURL(fileOrUrl);
    else if (fs.statSync(fileOrUrl).isFile()) {
      const data = fs.readFileSync(fileOrUrl);
      const blob = new Blob([data]);
      image = await RawImage.fromBlob(blob);
    }
    const { pixel_values } = await processor(image);
    const output = await model({ images: pixel_values });
    const permuted = output.output0[0];
    //const permuted = output.output0[0].transpose(1, 0);
    const result = [];
    const threshold = 0.3;
    const [scaledHeight, scaledWidth] = pixel_values.dims.slice(-2);
    for (const [xc, yc, w, h, ...scores] of permuted.tolist()) {
      // Get pixel values, taking into account the original image size
      const x1 = (xc / scaledWidth) * image.width;
      const y1 = (yc / scaledHeight) * image.height;
      const x2 = (w / scaledWidth) * image.width;
      const y2 = (h / scaledHeight) * image.height;

      const score = scores[0];
      if (score > threshold) {
        const label = model.config.id2label[scores[1]];
        result.push({
          x1,
          x2,
          y1,
          y2,
          score,
          label,
          index: scores[1],
        });
      }
    }

    // const image_draw = sharp(fileOrUrl);
    // const metadata = await image_draw.metadata();

    // const { width, height } = metadata;

    // 创建一个新的画布，大小为原图加上边框
    // const newWidth = width + borderWidth * 2;
    // const newHeight = height + borderWidth * 2;
    // const borderWidth = 2;
    // const borderColor = '#ff0000';
    // const draw = [
    //   ...result.map((item) => {
    //     const _item = {
    //       x1: Math.round(item.x1),
    //       y1: Math.round(item.y1),
    //       x2: Math.round(item.x2),
    //       y2: Math.round(item.y2),
    //       score: item.score,
    //       label: item.label,
    //       index: item.index,
    //     };
    //     return {
    //       input: Buffer.from(
    //         `<svg width="${_item.x2 - _item.x1}" height="${_item.y2 - _item.y1 + 20}">
    //       <rect x="0" y="0" width="${_item.x2 - _item.x1}" height="${_item.y2 - _item.y1}"
    //             stroke="${borderColor}" stroke-width="${borderWidth}" fill="none" />
    //       <text x="5" y="${_item.y2 - _item.y1 + 15}" font-family="Arial" font-size="12" fill="${borderColor}">
    //       [${_item.index}] ${_item.label} (${(_item.score * 100).toFixed(1)}%)
    //       </text>
    //     </svg>`,
    //       ),
    //       top: Math.round(item.y1),
    //       left: Math.round(item.x1),
    //     };
    //   }),
    // ];
    return result;
    // const outputImagePath = path.join(getModelsPath(), 'other', 'output.png');

    // // 创建一个Promise来处理图像并返回base64
    // return new Promise((resolve, reject) => {
    //   sharp(fileOrUrl)
    //     .composite(draw)
    //     .toBuffer()
    //     .then((outputBuffer) => {
    //       // 保存文件
    //       fs.writeFileSync(outputImagePath, outputBuffer);
    //       console.log('边框和文字已成功绘制，图片保存为:', outputImagePath);

    //       // 转换为base64并返回
    //       const base64Image = `data:image/${metadata.format || 'png'};base64,${outputBuffer.toString('base64')}`;
    //       resolve({
    //         result,
    //         base64Image,
    //         outputPath: outputImagePath,
    //       });
    //       return base64Image; // 返回值以修复linter错误
    //     })
    //     .catch((err) => {
    //       console.error('处理图片时出错:', err);
    //       reject(err);
    //       throw err; // 抛出错误以修复linter错误
    //     });
    // });
  }
}
