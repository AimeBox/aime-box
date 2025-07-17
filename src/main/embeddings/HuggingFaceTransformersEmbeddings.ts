import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings';
import { chunkArray } from '@langchain/core/utils/chunk_array';
import { app } from 'electron';
// import transformers from '@huggingface/transformers';
import path from 'path';
import { getModelsPath } from '../utils/path';
import {
  AutoProcessor,
  AutoTokenizer,
  AutoModelForSequenceClassification,
  RawImage,
  AutoModel,
  env,
  pipeline,
  ChineseCLIPModel,
} from '@huggingface/transformers';

export interface HuggingFaceTransformersEmbeddingsParams
  extends EmbeddingsParams {
  /** Model name to use */
  modelName: string;
  /**
   * Timeout to use when making requests to OpenAI.
   */
  timeout?: number;
  /**
   * The maximum number of documents to embed in a single request.
   */
  batchSize?: number;
  /**
   * Whether to strip new lines from the input text. This is recommended by
   * OpenAI, but may not be suitable for all use cases.
   */
  stripNewLines?: boolean;
}
// eslint-disable-next-line import/prefer-default-export
export class HuggingFaceTransformersEmbeddings
  extends Embeddings
  implements HuggingFaceTransformersEmbeddingsParams
{
  private TransformersApi = null;

  private pipeline = null;

  modelName: string;

  batchSize: number = 32;

  stripNewLines: boolean = true;

  timeout?: number;

  pipelinePromise = null;

  constructor(fields?: Partial<HuggingFaceTransformersEmbeddingsParams>) {
    super(fields ?? {});
    this.modelName = fields?.modelName ?? this.modelName;
    this.stripNewLines = fields?.stripNewLines ?? this.stripNewLines;
    this.batchSize = fields?.batchSize ?? this.batchSize;
    this.timeout = fields?.timeout;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replace(/\n/g, ' ')) : texts,
      this.batchSize,
    );

    const batchRequests = batches.map((batch) => this.runEmbedding(batch));
    const batchResponses = await Promise.all(batchRequests);
    const embeddings = [];
    for (let i = 0; i < batchResponses.length; i += 1) {
      const batchResponse = batchResponses[i];
      for (let j = 0; j < batchResponse.length; j += 1) {
        embeddings.push(batchResponse[j]);
      }
    }
    return embeddings;
  }

  async embedQuery(text: string) {
    const data = await this.runEmbedding([
      this.stripNewLines ? text.replace(/\n/g, ' ') : text,
    ]);
    return data[0];
  }

  async runEmbedding(texts: string[]) {
    if (!this.pipeline) {
      env.localModelPath = path.join(getModelsPath(), 'embeddings');
      env.allowRemoteModels = false;
      this.pipeline = pipeline;
    }
    let pipe = null;
    if (!this.pipelinePromise) {
      pipe = await pipeline('feature-extraction', this.modelName, {
        // dtype: 'fp16',
      });
      this.pipelinePromise = pipe;
    }
    const that = this;

    return this.caller.call(async () => {
      try {
        const output = await that.pipelinePromise(texts, {
          pooling: 'cls',
          normalize: true,
        });
        const res = output.tolist();
        return res;
      } catch (err) {
        console.error(err);
        return [];
      }
    });
  }
}
