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
    // Object.defineProperty(this, 'pipelinePromise', {
    //   enumerable: true,
    //   configurable: true,
    //   writable: true,
    //   value: void 0,
    // });
    this.modelName = fields?.modelName ?? this.modelName;
    this.task = fields?.task ?? this.task;
    // this.TransformersApi = Function(
    //   'return import("@huggingface/transformers")',
    // )();
  }

  async rmbg(fileOrUrl: string) {
    // const { AutoProcessor, RawImage, AutoModel, env } =
    //   await this.TransformersApi;

    env.localModelPath = path.join(getModelsPath(), 'other');
    env.allowRemoteModels = false;

    this._model = await AutoModel.from_pretrained(this.modelName, {
      dtype: 'fp32',
      //quantized: false,
      local_files_only: true,
    });
    this._processor = await AutoProcessor.from_pretrained(this.modelName, {
      // Do not require config.json to be present in the repository
      // config: {
      //   do_normalize: true,
      //   do_pad: false,
      //   do_rescale: true,
      //   do_resize: true,
      //   image_mean: [0.5, 0.5, 0.5],
      //   feature_extractor_type: 'ImageFeatureExtractor',
      //   image_std: [1, 1, 1],
      //   resample: 2,
      //   rescale_factor: 0.00392156862745098,
      //   size: { width: 1024, height: 1024 },
      // },
    });

    this._rawImage = RawImage;
    let image = null;
    if (isUrl(fileOrUrl)) image = await RawImage.fromURL(fileOrUrl);
    else if (fs.statSync(fileOrUrl).isFile()) {
      const data = fs.readFileSync(fileOrUrl);
      const blob = new Blob([data]);
      image = await RawImage.fromBlob(blob);
    }

    const ar = image.width / image.height;
    const [cw, ch] = ar > 720 / 480 ? [720, 720 / ar] : [480 * ar, 480];
    const { pixel_values } = await this._processor(image);

    // Predict alpha matte
    const { output } = await this._model({ input: pixel_values });
    const mask = await RawImage.fromTensor(
      output[0].mul(255).to('uint8'),
    ).resize(image.width, image.height);
    const png = new PNG({ width: image.width, height: image.height });

    // const png = PNG.sync.read(image.data.buffer);
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const maskIndex = y * image.width + x;
        const imageIndex = (y * image.width + x) * 3;
        const pngIndex = (y * image.width + x) * 4;

        // 复制RGB值
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
}
